from flask import Blueprint, jsonify
from app.models import get_db_connection
from app.auth import token_required

dashboard_bp = Blueprint("dashboard", __name__, url_prefix="/api/dashboard")

@dashboard_bp.route("/summary", methods=["GET"])
@token_required
def get_dashboard_summary(current_user):
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Registered organizations count
    cursor.execute("SELECT COUNT(*) as count FROM organizations WHERE status = 'ACTIVE'")
    registered_orgs = cursor.fetchone()["count"]

    # 2. Active certificates count across the system
    cursor.execute("SELECT COUNT(*) as count FROM certificates WHERE status = 'ACTIVE'")
    active_certs = cursor.fetchone()["count"]

    # 3. Verification attempts count (from audit logs)
    cursor.execute("SELECT COUNT(*) as count FROM audit_logs WHERE event_type = 'CERT_VERIFIED'")
    verification_attempts = cursor.fetchone()["count"]

    # 4. Revoked certificates count
    cursor.execute("SELECT COUNT(*) as count FROM revocation_records")
    revoked_certs = cursor.fetchone()["count"]

    # 5. Recent activity (latest 10 events)
    cursor.execute("""
        SELECT id, timestamp, org_identifier, user_email, event_type, certificate_id, result, details
        FROM audit_logs
        ORDER BY id DESC
        LIMIT 10
    """)
    recent_activities = [dict(r) for r in cursor.fetchall()]

    conn.close()

    return jsonify({
        "metrics": {
            "registered_organizations": registered_orgs,
            "active_certificates": active_certs,
            "verification_attempts": verification_attempts,
            "revoked_certificates": revoked_certs
        },
        "recent_activities": recent_activities
    })

