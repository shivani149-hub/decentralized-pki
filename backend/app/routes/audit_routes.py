from flask import Blueprint, request, jsonify
from app.models import get_db_connection
from app.auth import token_required

audit_bp = Blueprint("audit", __name__, url_prefix="/api/audit")

@audit_bp.route("", methods=["GET"])
@token_required
def get_audit_logs(current_user):
    """
    Returns audit logs with search and filtering.
    Read-only endpoint. Users cannot alter or delete logs through the UI.
    """
    search = (request.args.get("search") or "").strip().lower()
    event_type = (request.args.get("event_type") or "").strip()
    result_filter = (request.args.get("result") or "").strip()

    conn = get_db_connection()
    cursor = conn.cursor()

    query = """
        SELECT id, timestamp, org_identifier, user_email, event_type, certificate_id, result, details, ip_address
        FROM audit_logs
        WHERE 1=1
    """
    params = []

    if event_type and event_type != "ALL":
        query += " AND event_type = ?"
        params.append(event_type)

    if result_filter and result_filter != "ALL":
        query += " AND result = ?"
        params.append(result_filter)

    if search:
        query += " AND (LOWER(org_identifier) LIKE ? OR LOWER(event_type) LIKE ? OR LOWER(certificate_id) LIKE ? OR LOWER(details) LIKE ?)"
        wildcard = f"%{search}%"
        params.extend([wildcard, wildcard, wildcard, wildcard])

    query += " ORDER BY id DESC LIMIT 200"
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()

    return jsonify([dict(r) for r in rows])

