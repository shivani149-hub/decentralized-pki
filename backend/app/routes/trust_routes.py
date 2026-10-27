from flask import Blueprint, request, jsonify
from app.models import get_db_connection
from app.auth import token_required
from app.trust_registry import TrustRegistry

trust_bp = Blueprint("trust", __name__, url_prefix="/api/trust")

@trust_bp.route("/organizations", methods=["GET"])
@token_required
def list_federated_organizations(current_user):
    """
    Returns public identities, public keys, and fingerprints stored in the shared Trust Registry.
    """
    orgs = TrustRegistry.list_all_federated_orgs()
    return jsonify(orgs)

@trust_bp.route("/policies", methods=["GET"])
@token_required
def get_local_trust_policies(current_user):
    """
    Returns the current organization's trust policies regarding all other federation members.
    """
    local_org = current_user["org_identifier"]
    conn = get_db_connection()
    cursor = conn.cursor()

    # Get all other organizations
    cursor.execute("""
        SELECT org_identifier, org_name, org_type, key_fingerprint, trust_status
        FROM trust_registry
        WHERE org_identifier != ?
    """, (local_org,))
    peers = [dict(r) for r in cursor.fetchall()]

    policies = []
    for peer in peers:
        p = TrustRegistry.get_trust_policy(local_org, peer["org_identifier"])
        policies.append({
            "peer_org_identifier": peer["org_identifier"],
            "peer_org_name": peer["org_name"],
            "key_fingerprint": peer["key_fingerprint"],
            "registry_status": peer["trust_status"],
            "is_trusted": p["is_trusted"],
            "trust_level": p["trust_level"],
            "notes": p["notes"]
        })

    conn.close()
    return jsonify(policies)

@trust_bp.route("/policies", methods=["POST"])
@token_required
def update_trust_policy(current_user):
    """
    Updates the local organization's trust status towards a peer organization.
    """
    local_org = current_user["org_identifier"]
    data = request.get_json() or {}
    peer_org = (data.get("peer_org_identifier") or "").strip()
    is_trusted = bool(data.get("is_trusted", True))
    notes = (data.get("notes") or "").strip()

    if not peer_org:
        return jsonify({"error": "Peer organization identifier is required."}), 400

    TrustRegistry.set_trust_policy(local_org, peer_org, is_trusted, notes)

    return jsonify({
        "message": f"Trust policy updated: Peer '{peer_org}' is now marked as {'TRUSTED' if is_trusted else 'UNTRUSTED'}.",
        "peer_org_identifier": peer_org,
        "is_trusted": is_trusted
    })

@trust_bp.route("/public-key/<org_identifier>", methods=["GET"])
def get_public_key_unauthenticated(org_identifier):
    """
    Public registry lookup endpoint for an organization's public key and fingerprint.
    No private data is ever returned.
    """
    issuer_info = TrustRegistry.get_issuer_public_key(org_identifier)
    if not issuer_info:
        return jsonify({"error": f"Organization '{org_identifier}' not found in trust registry."}), 404

    return jsonify({
        "org_identifier": issuer_info["org_identifier"],
        "org_name": issuer_info["org_name"],
        "key_fingerprint": issuer_info["key_fingerprint"],
        "public_key_pem": issuer_info["public_key_pem"],
        "trust_status": issuer_info["trust_status"]
    })

