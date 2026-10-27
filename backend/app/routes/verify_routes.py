import json
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify
from app.models import get_db_connection, log_audit_event
from app.auth import token_required
from app.crypto_engine import verify_payload_signature, compute_public_key_fingerprint
from app.trust_registry import TrustRegistry

verify_bp = Blueprint("verify", __name__, url_prefix="/api/verify")

@verify_bp.route("", methods=["POST"])
@token_required
def verify_certificate(current_user):
    """
    Cross-organizational Certificate Verification Engine.
    Executes the 5 required enterprise verification checks:
    1. Structure and required fields
    2. Cryptographic signature with issuer public key
    3. Issuer trust federation & policy
    4. Validity period (not before, not after)
    5. Authoritative revocation check
    """
    body = request.get_json() or {}
    verifying_org = current_user["org_identifier"]

    # Either cert_data JSON or cert_id provided
    cert_envelope = body.get("certificate")
    cert_id = body.get("cert_id")

    if not cert_envelope and cert_id:
        # Load from database/registry if cert_id given
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT certificate_json FROM certificates WHERE cert_id = ?", (cert_id,))
        row = cursor.fetchone()
        conn.close()
        if not row:
            return jsonify({
                "overall_status": "FAILED",
                "message": f"Certificate with ID '{cert_id}' could not be located in registry.",
                "checks": {
                    "structure": {"status": "FAILED", "message": "Certificate record not found."}
                }
            }), 404
        try:
            cert_envelope = json.loads(row["certificate_json"])
        except Exception as e:
            return jsonify({
                "overall_status": "FAILED",
                "message": "Corrupted certificate record.",
                "error": str(e)
            }), 400

    if not cert_envelope or not isinstance(cert_envelope, dict):
        return jsonify({"error": "Certificate payload or valid Certificate ID is required for verification."}), 400

    checks = {}
    is_valid_overall = True
    failure_reasons = []

    # ---------------------------------------------------------
    # CHECK 1: Certificate Structure and Required-Field Validation
    # ---------------------------------------------------------
    required_keys = ["tbs_certificate", "signature_algorithm", "signature_value"]
    tbs_required_keys = ["cert_id", "issuer", "subject", "validity", "subject_public_key_pem"]

    structure_ok = True
    structure_error = None

    for key in required_keys:
        if key not in cert_envelope:
            structure_ok = False
            structure_error = f"Missing top-level attribute: '{key}'"
            break

    if structure_ok:
        tbs = cert_envelope.get("tbs_certificate")
        if not isinstance(tbs, dict):
            structure_ok = False
            structure_error = "'tbs_certificate' must be an object."
        else:
            for tbs_k in tbs_required_keys:
                if tbs_k not in tbs:
                    structure_ok = False
                    structure_error = f"Missing required certificate field: '{tbs_k}'"
                    break

    if not structure_ok:
        checks["structure"] = {
            "name": "Certificate Structure",
            "status": "FAILED",
            "label": "Invalid Structure",
            "message": structure_error or "Certificate format malformed or invalid schema."
        }
        is_valid_overall = False
        failure_reasons.append(structure_error)

        log_audit_event(
            org_identifier=verifying_org,
            event_type="CERT_VERIFIED",
            result="STRUCTURE_FAILED",
            user_email=current_user["email"],
            details=f"Verification failed schema check: {structure_error}"
        )
        return jsonify({
            "overall_status": "FAILED",
            "summary": "VERIFICATION FAILED",
            "checks": checks,
            "failure_reasons": failure_reasons
        })

    checks["structure"] = {
        "name": "Certificate Structure",
        "status": "PASSED",
        "label": "Valid",
        "message": "Certificate schema and required cryptographic fields are intact."
    }

    tbs = cert_envelope["tbs_certificate"]
    cert_id_val = tbs.get("cert_id", "UNKNOWN")
    issuer_org_id = tbs.get("issuer", {}).get("org_identifier")
    signature_b64 = cert_envelope.get("signature_value")

    # ---------------------------------------------------------
    # CHECK 2: Digital Signature Verification
    # ---------------------------------------------------------
    # Fetch issuer public key from Trust Registry
    issuer_record = TrustRegistry.get_issuer_public_key(issuer_org_id)
    if not issuer_record:
        checks["signature"] = {
            "name": "Digital Signature",
            "status": "FAILED",
            "label": "Cannot Verify",
            "message": f"Issuer '{issuer_org_id}' public key is not registered in the Trust Registry."
        }
        is_valid_overall = False
        failure_reasons.append(f"Issuer public key for '{issuer_org_id}' is not in the Trust Registry.")
    else:
        issuer_pub_pem = issuer_record["public_key_pem"]
        sig_valid, sig_msg = verify_payload_signature(issuer_pub_pem, tbs, signature_b64)
        if sig_valid:
            checks["signature"] = {
                "name": "Digital Signature",
                "status": "PASSED",
                "label": "Valid",
                "message": "Cryptographic signature is mathematically valid and verified with issuer's registered public key."
            }
        else:
            checks["signature"] = {
                "name": "Digital Signature",
                "status": "FAILED",
                "label": "Invalid",
                "message": sig_msg
            }
            is_valid_overall = False
            failure_reasons.append(f"Digital signature mismatch: {sig_msg}")

    # ---------------------------------------------------------
    # CHECK 3: Issuer Trust Validation (Trust Policy Check)
    # ---------------------------------------------------------
    if not issuer_record:
        checks["issuer_trust"] = {
            "name": "Issuer Trust",
            "status": "FAILED",
            "label": "Untrusted",
            "message": f"Issuer organization '{issuer_org_id}' is unknown in the federation."
        }
        is_valid_overall = False
        failure_reasons.append(f"Issuer '{issuer_org_id}' is not part of the trusted federation.")
    elif issuer_record.get("trust_status") != "TRUSTED":
        checks["issuer_trust"] = {
            "name": "Issuer Trust",
            "status": "FAILED",
            "label": "Registry Suspended",
            "message": f"Issuer '{issuer_org_id}' status in the Trust Registry is '{issuer_record.get('trust_status')}'."
        }
        is_valid_overall = False
        failure_reasons.append(f"Issuer '{issuer_org_id}' has registry status '{issuer_record.get('trust_status')}'.")
    else:
        # Check local policy between verifying_org and issuer_org_id
        policy = TrustRegistry.get_trust_policy(verifying_org, issuer_org_id)
        if policy["is_trusted"]:
            checks["issuer_trust"] = {
                "name": "Issuer Trust",
                "status": "PASSED",
                "label": "Trusted",
                "message": f"Issuer '{issuer_org_id}' is verified in Trust Registry and trusted under policy ({policy['trust_level']})."
            }
        else:
            checks["issuer_trust"] = {
                "name": "Issuer Trust",
                "status": "FAILED",
                "label": "Untrusted Policy",
                "message": f"Organization '{verifying_org}' has explicitly untrusted peer '{issuer_org_id}' in its local trust policy."
            }
            is_valid_overall = False
            failure_reasons.append(f"Issuer '{issuer_org_id}' is rejected by local organization trust policy.")

    # ---------------------------------------------------------
    # CHECK 4: Validity Period Checking
    # ---------------------------------------------------------
    validity = tbs.get("validity", {})
    valid_from_str = validity.get("valid_from")
    valid_to_str = validity.get("valid_to")

    try:
        now_dt = datetime.now(timezone.utc)
        valid_from_dt = datetime.fromisoformat(valid_from_str)
        valid_to_dt = datetime.fromisoformat(valid_to_str)

        if now_dt < valid_from_dt:
            checks["expiry"] = {
                "name": "Certificate Validity Period",
                "status": "FAILED",
                "label": "Not Yet Valid",
                "message": f"Certificate is not valid until {valid_from_str}."
            }
            is_valid_overall = False
            failure_reasons.append("Certificate not yet valid (future effective date).")
        elif now_dt > valid_to_dt:
            checks["expiry"] = {
                "name": "Certificate Validity Period",
                "status": "FAILED",
                "label": "Expired",
                "message": f"Certificate expired on {valid_to_str}."
            }
            is_valid_overall = False
            failure_reasons.append(f"Certificate has expired ({valid_to_str}).")
        else:
            checks["expiry"] = {
                "name": "Certificate Validity Period",
                "status": "PASSED",
                "label": "Valid",
                "message": f"Active within validity window (Expires: {valid_to_str})."
            }
    except Exception as e:
        checks["expiry"] = {
            "name": "Certificate Validity Period",
            "status": "FAILED",
            "label": "Invalid Timestamps",
            "message": f"Failed to parse validity timestamps: {str(e)}"
        }
        is_valid_overall = False
        failure_reasons.append("Malformed certificate validity dates.")

    # ---------------------------------------------------------
    # CHECK 5: Certificate Revocation-Status Checking
    # ---------------------------------------------------------
    is_revoked, rev_record = TrustRegistry.check_revocation_status(cert_id_val)
    if is_revoked:
        checks["revocation"] = {
            "name": "Revocation Status",
            "status": "FAILED",
            "label": "Revoked",
            "message": f"Certificate was revoked on {rev_record['revoked_at']} by {rev_record['revoked_by_org']}. Reason: {rev_record['revocation_reason']}"
        }
        is_valid_overall = False
        failure_reasons.append(f"Certificate has been revoked: {rev_record['revocation_reason']}")
    else:
        checks["revocation"] = {
            "name": "Revocation Status",
            "status": "PASSED",
            "label": "Not Revoked",
            "message": "Certificate is not registered in the authoritative revocation list."
        }

    # Final Outcome
    overall_status = "PASSED" if is_valid_overall else "FAILED"
    summary_text = "VERIFICATION PASSED" if is_valid_overall else "VERIFICATION FAILED"

    # Log to Audit Trail
    log_audit_event(
        org_identifier=verifying_org,
        event_type="CERT_VERIFIED",
        result="SUCCESS" if is_valid_overall else "FAILED",
        certificate_id=cert_id_val,
        user_email=current_user["email"],
        details=f"Verification result: {overall_status}. Issuer: {issuer_org_id}. Reasons: {'; '.join(failure_reasons) if failure_reasons else 'All 5 checks passed'}"
    )

    return jsonify({
        "overall_status": overall_status,
        "summary": summary_text,
        "certificate_id": cert_id_val,
        "issuer": issuer_org_id,
        "subject": tbs.get("subject", {}),
        "checks": checks,
        "failure_reasons": failure_reasons,
        "verified_at": datetime.now(timezone.utc).isoformat()
    })

