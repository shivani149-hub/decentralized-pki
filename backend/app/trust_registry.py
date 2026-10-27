"""
Decentralized PKI Trust Registry Interface and Implementation

In a federated decentralized PKI architecture, the Trust Registry acts as an authoritative,
shared, public state layer (such as a distributed ledger, consortium blockchain, or federated DHT).
It maintains:
1. Public identity and public keys of federated organizations.
2. Authoritative certificate revocation records.
3. Cryptographic fingerprints for issuer key validation.

Crucially:
- Private keys NEVER enter the trust registry.
- Participating organizations verify certificates against this shared registry without
  relying on a single centralized proprietary Certificate Authority (CA) or sharing secrets.
"""

from datetime import datetime, timezone
from app.models import get_db_connection, log_audit_event
from app.crypto_engine import compute_public_key_fingerprint

class TrustRegistry:
    """
    Interface and implementation for the Federated Trust Registry.
    Provides verifiable public key distribution and revocation status lookups.
    """

    @staticmethod
    def publish_identity(org_identifier, org_name, org_type, public_key_pem):
        """
        Publishes or updates an organization's public identity and public key in the shared registry.
        """
        conn = get_db_connection()
        cursor = conn.cursor()
        now_utc = datetime.now(timezone.utc).isoformat()
        fingerprint = compute_public_key_fingerprint(public_key_pem)

        cursor.execute("""
            INSERT INTO trust_registry (org_identifier, org_name, org_type, public_key_pem, key_fingerprint, trust_status, registered_at, last_updated)
            VALUES (?, ?, ?, ?, ?, 'TRUSTED', ?, ?)
            ON CONFLICT(org_identifier) DO UPDATE SET
                org_name = excluded.org_name,
                org_type = excluded.org_type,
                public_key_pem = excluded.public_key_pem,
                key_fingerprint = excluded.key_fingerprint,
                last_updated = excluded.last_updated
        """, (org_identifier, org_name, org_type, public_key_pem, fingerprint, now_utc, now_utc))

        conn.commit()
        conn.close()

        log_audit_event(
            org_identifier=org_identifier,
            event_type="TRUST_REGISTRY_PUBLISH",
            result="SUCCESS",
            details=f"Public key published to federated registry. Fingerprint: {fingerprint}"
        )
        return fingerprint

    @staticmethod
    def get_issuer_public_key(org_identifier):
        """
        Retrieves the public key and status of an issuer from the registry.
        """
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT org_identifier, org_name, org_type, public_key_pem, key_fingerprint, trust_status
            FROM trust_registry
            WHERE org_identifier = ?
        """, (org_identifier,))
        row = cursor.fetchone()
        conn.close()

        if row:
            return dict(row)
        return None

    @staticmethod
    def list_all_federated_orgs():
        """
        Returns all registered organizations in the federation.
        """
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT org_identifier, org_name, org_type, key_fingerprint, trust_status, registered_at, last_updated
            FROM trust_registry
            ORDER BY registered_at ASC
        """)
        rows = cursor.fetchall()
        conn.close()
        return [dict(r) for r in rows]

    @staticmethod
    def check_revocation_status(cert_id):
        """
        Queries the trust registry for revocation records for a specific certificate ID.
        Returns: (is_revoked: bool, record_dict or None)
        """
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT cert_id, revoked_by_org, revocation_reason, revoked_at, revocation_signature
            FROM revocation_records
            WHERE cert_id = ?
        """, (cert_id,))
        row = cursor.fetchone()
        conn.close()

        if row:
            return True, dict(row)
        return False, None

    @staticmethod
    def register_revocation(cert_id, revoked_by_org, reason, signature="SIGNED_BY_ISSUER"):
        """
        Publishes a revocation event to the shared trust registry.
        """
        conn = get_db_connection()
        cursor = conn.cursor()
        now_utc = datetime.now(timezone.utc).isoformat()

        cursor.execute("""
            INSERT INTO revocation_records (cert_id, revoked_by_org, revocation_reason, revoked_at, revocation_signature)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(cert_id) DO UPDATE SET
                revocation_reason = excluded.revocation_reason,
                revoked_at = excluded.revoked_at
        """, (cert_id, revoked_by_org, reason, now_utc, signature))

        # Also update the certificate table status if present
        cursor.execute("""
            UPDATE certificates SET status = 'REVOKED' WHERE cert_id = ?
        """, (cert_id,))

        conn.commit()
        conn.close()

        log_audit_event(
            org_identifier=revoked_by_org,
            event_type="CERT_REVOKED",
            result="SUCCESS",
            certificate_id=cert_id,
            details=f"Certificate {cert_id} revoked by {revoked_by_org}. Reason: {reason}"
        )
        return True

    @staticmethod
    def get_trust_policy(local_org_identifier, peer_org_identifier):
        """
        Retrieves local organization's policy regarding trust for peer organization.
        """
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT is_trusted, trust_level, notes
            FROM trust_policies
            WHERE local_org_identifier = ? AND peer_org_identifier = ?
        """, (local_org_identifier, peer_org_identifier))
        row = cursor.fetchone()
        conn.close()

        if row:
            return {
                "is_trusted": bool(row["is_trusted"]),
                "trust_level": row["trust_level"],
                "notes": row["notes"]
            }
        # Default policy: if in same federation registry, default to trusted unless explicitly blocked
        return {
            "is_trusted": True,
            "trust_level": "FEDERATED",
            "notes": "Default federated peer trust policy"
        }

    @staticmethod
    def set_trust_policy(local_org_identifier, peer_org_identifier, is_trusted, notes=""):
        conn = get_db_connection()
        cursor = conn.cursor()
        now_utc = datetime.now(timezone.utc).isoformat()
        cursor.execute("""
            INSERT INTO trust_policies (local_org_identifier, peer_org_identifier, is_trusted, trust_level, notes, updated_at)
            VALUES (?, ?, ?, 'CUSTOM', ?, ?)
            ON CONFLICT(local_org_identifier, peer_org_identifier) DO UPDATE SET
                is_trusted = excluded.is_trusted,
                notes = excluded.notes,
                updated_at = excluded.updated_at
        """, (local_org_identifier, peer_org_identifier, 1 if is_trusted else 0, notes, now_utc))
        conn.commit()
        conn.close()

        log_audit_event(
            org_identifier=local_org_identifier,
            event_type="TRUST_POLICY_UPDATED",
            result="SUCCESS",
            details=f"Trust policy for {peer_org_identifier} set to {'TRUSTED' if is_trusted else 'UNTRUSTED'}"
        )

