import json
from flask import Blueprint, request, jsonify, Response
from datetime import datetime, timezone
from app.models import get_db_connection, log_audit_event
from app.auth import token_required
from app.crypto_engine import generate_rsa_keypair, issue_digital_certificate, compute_public_key_fingerprint
from app.trust_registry import TrustRegistry

cert_bp = Blueprint("certificates", __name__, url_prefix="/api/certificates")

@cert_bp.route("", methods=["GET"])
@token_required
def list_certificates(current_user):
    """
    Lists certificates with optional search and filter.
    Returns certificates across federation or filtered by issuer/subject.
    """
    search = (request.args.get("search") or "").strip().lower()
    status_filter = (request.args.get("status") or "").strip().upper()

    conn = get_db_connection()
    cursor = conn.cursor()

    query = """
        SELECT id, cert_id, issuer_org_identifier, issuer_name, subject_common_name,
               subject_org_identifier, subject_type, valid_from, valid_to, status,
               signature_algorithm, created_at
        FROM certificates
        WHERE 1=1
    """
    params = []

    if status_filter and status_filter != "ALL":
        query += " AND status = ?"
        params.append(status_filter)

    if search:
        query += " AND (LOWER(cert_id) LIKE ? OR LOWER(subject_common_name) LIKE ? OR LOWER(issuer_org_identifier) LIKE ?)"
        wildcard = f"%{search}%"
        params.extend([wildcard, wildcard, wildcard])

    query += " ORDER BY id DESC"
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()

    return jsonify([dict(r) for r in rows])

@cert_bp.route("/<cert_id>", methods=["GET"])
@token_required
def get_certificate_details(current_user, cert_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT * FROM certificates WHERE cert_id = ?
    """, (cert_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        return jsonify({"error": f"Certificate with ID '{cert_id}' not found."}), 404

    cert_data = dict(row)
    # Parse json stored representation
    try:
        cert_data["full_envelope"] = json.loads(cert_data["certificate_json"])
    except Exception:
        cert_data["full_envelope"] = None

    return jsonify(cert_data)

@cert_bp.route("/<cert_id>/download", methods=["GET"])
@token_required
def download_certificate(current_user, cert_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT certificate_json FROM certificates WHERE cert_id = ?", (cert_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        return jsonify({"error": "Certificate not found."}), 404

    return Response(
        row["certificate_json"],
        mimetype="application/json",
        headers={"Content-Disposition": f"attachment;filename={cert_id}.json"}
    )

@cert_bp.route("/keystore-status", methods=["GET"])
@token_required
def get_keystore_status(current_user):
    """
    Returns public key info for the current organization.
    Private key is strictly NOT returned.
    """
    org_id = current_user["org_identifier"]
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT key_type, public_key_pem, key_fingerprint, created_at, is_active
        FROM org_keystores
        WHERE org_identifier = ? AND is_active = 1
        ORDER BY id DESC LIMIT 1
    """, (org_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        return jsonify({"has_keypair": False})

    return jsonify({
        "has_keypair": True,
        "key_type": row["key_type"],
        "key_fingerprint": row["key_fingerprint"],
        "public_key_pem": row["public_key_pem"],
        "created_at": row["created_at"]
    })

@cert_bp.route("/generate-key", methods=["POST"])
@token_required
def generate_keypair(current_user):
    """
    Generates a new RSA-2048 keypair for the active organization.
    Stores private key securely in keystore, publishes public key to Trust Registry.
    """
    org_id = current_user["org_identifier"]
    org_name = current_user["org_name"]
    now_utc = datetime.now(timezone.utc).isoformat()

    private_pem, public_pem, fingerprint = generate_rsa_keypair(key_size=2048)

    conn = get_db_connection()
    cursor = conn.cursor()

    # Deactivate existing active keys
    cursor.execute("UPDATE org_keystores SET is_active = 0 WHERE org_identifier = ?", (org_id,))

    # Insert new key
    cursor.execute("""
        INSERT INTO org_keystores (org_identifier, key_type, public_key_pem, private_key_pem, key_fingerprint, created_at, is_active)
        VALUES (?, 'RSA-2048', ?, ?, ?, ?, 1)
    """, (org_id, public_pem, private_pem, fingerprint, now_utc))
    conn.commit()
    conn.close()

    # Update public Trust Registry
    TrustRegistry.publish_identity(org_id, org_name, current_user.get("org_type", "Enterprise"), public_pem)

    log_audit_event(
        org_identifier=org_id,
        event_type="KEYPAIR_GENERATED",
        result="SUCCESS",
        user_email=current_user["email"],
        details=f"Generated new RSA-2048 keypair. Key Fingerprint: {fingerprint}"
    )

    return jsonify({
        "message": "Cryptographic keypair generated and public key published to trust registry.",
        "key_fingerprint": fingerprint,
        "public_key_pem": public_pem
    })

@cert_bp.route("/issue", methods=["POST"])
@token_required
def issue_certificate(current_user):
    """
    Issues a digitally signed certificate for a subject identity using the organization's private key.
    """
    data = request.get_json() or {}
    subject_common_name = (data.get("subject_common_name") or "").strip()
    subject_org_id = (data.get("subject_org_identifier") or current_user["org_identifier"]).strip()
    subject_type = (data.get("subject_type") or "ServiceIdentity").strip()
    validity_days = int(data.get("validity_days") or 365)

    if not subject_common_name:
        return jsonify({"error": "Subject Common Name is required."}), 400

    issuer_org_id = current_user["org_identifier"]
    issuer_name = current_user["org_name"]

    # Load active private key
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT private_key_pem, public_key_pem
        FROM org_keystores
        WHERE org_identifier = ? AND is_active = 1
        ORDER BY id DESC LIMIT 1
    """, (issuer_org_id,))
    key_row = cursor.fetchone()

    if not key_row:
        conn.close()
        return jsonify({"error": "No active cryptographic keypair found for this organization. Generate keys first."}), 400

    # Cryptographically issue certificate
    certificate_envelope = issue_digital_certificate(
        issuer_org_id=issuer_org_id,
        issuer_name=issuer_name,
        issuer_private_key_pem=key_row["private_key_pem"],
        issuer_public_key_pem=key_row["public_key_pem"],
        subject_common_name=subject_common_name,
        subject_org_id=subject_org_id,
        subject_type=subject_type,
        validity_days=validity_days
    )

    tbs = certificate_envelope["tbs_certificate"]
    now_utc = datetime.now(timezone.utc).isoformat()
    cert_json_str = json.dumps(certificate_envelope, indent=2)

    cursor.execute("""
        INSERT INTO certificates (
            cert_id, issuer_org_identifier, issuer_name, subject_common_name,
            subject_org_identifier, subject_type, subject_public_key_pem,
            valid_from, valid_to, status, signature_algorithm, signature_b64,
            certificate_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?, ?)
    """, (
        tbs["cert_id"],
        issuer_org_id,
        issuer_name,
        subject_common_name,
        subject_org_id,
        subject_type,
        tbs["subject_public_key_pem"],
        tbs["validity"]["valid_from"],
        tbs["validity"]["valid_to"],
        tbs["signature_algorithm"],
        certificate_envelope["signature_value"],
        cert_json_str,
        now_utc
    ))

    conn.commit()
    conn.close()

    log_audit_event(
        org_identifier=issuer_org_id,
        event_type="CERT_ISSUED",
        result="SUCCESS",
        certificate_id=tbs["cert_id"],
        user_email=current_user["email"],
        details=f"Issued certificate {tbs['cert_id']} for subject '{subject_common_name}' ({subject_type})"
    )

    return jsonify({
        "message": f"Certificate {tbs['cert_id']} successfully issued and digitally signed.",
        "certificate": certificate_envelope
    }), 201

