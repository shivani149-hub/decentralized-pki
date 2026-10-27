from flask import Blueprint, request, jsonify
from datetime import datetime, timezone
from app.models import get_db_connection, log_audit_event
from app.auth import hash_password, verify_password, generate_jwt_token, token_required
from app.crypto_engine import generate_rsa_keypair
from app.trust_registry import TrustRegistry

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")

@auth_bp.route("/demo-organizations", methods=["GET"])
def get_demo_organizations():
    """Returns list of organizations for the login selector."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT identifier, name, org_type FROM organizations WHERE status = 'ACTIVE' ORDER BY identifier ASC")
    orgs = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return jsonify(orgs)

@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    org_identifier = (data.get("org_identifier") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not org_identifier or not email or not password:
        return jsonify({"error": "Organization, email, and password are required."}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    # Find organization
    cursor.execute("SELECT id, name, identifier, status FROM organizations WHERE identifier = ?", (org_identifier,))
    org = cursor.fetchone()
    if not org:
        conn.close()
        return jsonify({"error": f"Organization '{org_identifier}' not found."}), 404

    # Find user in that organization
    cursor.execute("""
        SELECT id, email, password_hash, role
        FROM users
        WHERE org_id = ? AND LOWER(email) = ?
    """, (org["id"], email))
    user = cursor.fetchone()
    conn.close()

    if not user or not verify_password(password, user["password_hash"]):
        log_audit_event(
            org_identifier=org_identifier,
            event_type="AUTH_LOGIN_FAILED",
            result="FAILURE",
            user_email=email,
            details="Invalid credentials or unauthorized organization account."
        )
        return jsonify({"error": "Invalid email or password for the selected organization."}), 401

    token = generate_jwt_token(
        user_id=user["id"],
        email=user["email"],
        org_identifier=org["identifier"],
        org_name=org["name"],
        role=user["role"]
    )

    log_audit_event(
        org_identifier=org_identifier,
        event_type="AUTH_LOGIN_SUCCESS",
        result="SUCCESS",
        user_email=email,
        details="User authenticated successfully."
    )

    return jsonify({
        "message": "Authentication successful.",
        "token": token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "role": user["role"],
            "org_identifier": org["identifier"],
            "org_name": org["name"]
        }
    })

@auth_bp.route("/register-org", methods=["POST"])
def register_organization():
    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    identifier = (data.get("identifier") or "").strip().upper()
    org_type = (data.get("org_type") or "Enterprise").strip()
    contact_email = (data.get("contact_email") or "").strip().lower()
    admin_email = (data.get("admin_email") or "").strip().lower()
    admin_password = data.get("admin_password") or ""

    if not name or not identifier or not contact_email or not admin_email or not admin_password:
        return jsonify({"error": "All fields are required for organization registration."}), 400

    if len(admin_password) < 6:
        return jsonify({"error": "Admin password must be at least 6 characters."}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    # Check duplicate identifier
    cursor.execute("SELECT id FROM organizations WHERE identifier = ?", (identifier,))
    if cursor.fetchone():
        conn.close()
        return jsonify({"error": f"Organization identifier '{identifier}' is already registered."}), 409

    # Check duplicate email
    cursor.execute("SELECT id FROM users WHERE LOWER(email) = ?", (admin_email,))
    if cursor.fetchone():
        conn.close()
        return jsonify({"error": f"User email '{admin_email}' is already registered."}), 409

    now_utc = datetime.now(timezone.utc).isoformat()

    # Insert Organization
    cursor.execute("""
        INSERT INTO organizations (name, identifier, org_type, contact_email, status, created_at)
        VALUES (?, ?, ?, ?, 'ACTIVE', ?)
    """, (name, identifier, org_type, contact_email, now_utc))
    org_id = cursor.lastrowid

    # Insert Admin User
    hashed = hash_password(admin_password)
    cursor.execute("""
        INSERT INTO users (org_id, email, password_hash, role, created_at)
        VALUES (?, ?, ?, 'ADMIN', ?)
    """, (org_id, admin_email, hashed, now_utc))

    # Automatic initial key generation for new organization onboarding
    private_pem, public_pem, fingerprint = generate_rsa_keypair(key_size=2048)
    cursor.execute("""
        INSERT INTO org_keystores (org_identifier, key_type, public_key_pem, private_key_pem, key_fingerprint, created_at, is_active)
        VALUES (?, 'RSA-2048', ?, ?, ?, ?, 1)
    """, (identifier, public_pem, private_pem, fingerprint, now_utc))

    conn.commit()
    conn.close()

    # Register in public trust registry
    TrustRegistry.publish_identity(identifier, name, org_type, public_pem)

    log_audit_event(
        org_identifier=identifier,
        event_type="ORG_REGISTERED",
        result="SUCCESS",
        user_email=admin_email,
        details=f"Organization {name} ({identifier}) registered and onboarded with RSA-2048 keypair."
    )

    return jsonify({
        "message": f"Organization '{name}' registered and onboarded successfully.",
        "identifier": identifier,
        "key_fingerprint": fingerprint
    }), 201

@auth_bp.route("/me", methods=["GET"])
@token_required
def get_current_user(current_user):
    return jsonify({
        "user": {
            "id": current_user["id"],
            "email": current_user["email"],
            "role": current_user["role"],
            "org_identifier": current_user["org_identifier"],
            "org_name": current_user["org_name"],
            "org_type": current_user["org_type"]
        }
    })

