from datetime import datetime, timezone
from flask import Blueprint, request, jsonify
from app.models import get_db_connection, log_audit_event
from app.auth import token_required
from app.trust_registry import TrustRegistry

revocation_bp = Blueprint("revocation", __name__, url_prefix="/api/revocations")

@revocation_bp.route("", methods=["GET"])
@token_required
def list_revocations(current_user):
    """
    Returns list of all revoked certificates and their authoritative metadata.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT r.id, r.cert_id, r.revoked_by_org, r.revocation_reason, r.revoked_at,
               c.subject_common_name, c.issuer_name, c.issuer_org_identifier, c.status
        FROM revocation_records r
        LEFT JOIN certificates c ON r.cert_id = c.cert_id
        ORDER BY r.id DESC
    """)
    rows = cursor.fetchall()
    conn.close()

    result = []
    for r in rows:
        result.append({
            "id": r["id"],
            "cert_id": r["cert_id"],
            "issuer": r["issuer_org_identifier"] or r["revoked_by_org"],
            "subject": r["subject_common_name"] or "External Identity",
            "revoked_by_org": r["revoked_by_org"],
            "reason": r["revocation_reason"],
            "revoked_at": r["revoked_at"],
            "status": "REVOKED"
        })

    return jsonify(result)

@revocation_bp.route("/revoke", methods=["POST"])
@token_required
def revoke_certificate(current_user):
    """
    Authoritative revocation of a certificate.
    Enforces authorization: Only the issuing organization can revoke a certificate!
    """
    data = request.get_json() or {}
    cert_id = (data.get("cert_id") or "").strip()
    reason = (data.get("reason") or "Key Compromise").strip()

    if not cert_id:
        return jsonify({"error": "Certificate ID is required for revocation."}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT cert_id, issuer_org_identifier, status FROM certificates WHERE cert_id = ?", (cert_id,))
    cert = cursor.fetchone()
    conn.close()

    if not cert:
        return jsonify({"error": f"Certificate '{cert_id}' not found in registry."}), 404

    # Enforce authorization: only the issuer organization can revoke!
    caller_org = current_user["org_identifier"]
    if cert["issuer_org_identifier"] != caller_org and current_user.get("role") != "SYSTEM_ADMIN":
        log_audit_event(
            org_identifier=caller_org,
            event_type="UNAUTHORIZED_REVOKE_ATTEMPT",
            result="DENIED",
            certificate_id=cert_id,
            user_email=current_user["email"],
            details=f"Organization {caller_org} attempted to revoke certificate {cert_id} owned by {cert['issuer_org_identifier']}."
        )
        return jsonify({
            "error": f"Authorization denied: Only the issuer ({cert['issuer_org_identifier']}) can revoke this certificate."
        }), 403

    if cert["status"] == "REVOKED":
        return jsonify({"message": f"Certificate {cert_id} is already revoked."}), 200

    # Publish revocation in trust registry
    TrustRegistry.register_revocation(
        cert_id=cert_id,
        revoked_by_org=caller_org,
        reason=reason
    )

    return jsonify({
        "message": f"Certificate {cert_id} has been revoked successfully.",
        "cert_id": cert_id,
        "reason": reason,
        "revoked_at": datetime.now(timezone.utc).isoformat()
    })

