import sys
import os
from pathlib import Path
from datetime import datetime, timezone

# Ensure backend root is on sys.path
backend_path = Path(__file__).resolve().parent
if str(backend_path) not in sys.path:
    sys.path.insert(0, str(backend_path))

from app.models import init_db, get_db_connection, log_audit_event
from app.auth import hash_password
from app.crypto_engine import generate_rsa_keypair
from app.trust_registry import TrustRegistry

def seed_database():
    print("Initializing Decentralized PKI database schema...")
    init_db()

    conn = get_db_connection()
    cursor = conn.cursor()

    demo_orgs = [
        {
            "name": "Organization A",
            "identifier": "ORG-A",
            "org_type": "Financial Services",
            "contact_email": "compliance@org-a.internal",
            "admin_email": "admin@org-a.internal",
            "password": "Password123!"
        },
        {
            "name": "Organization B",
            "identifier": "ORG-B",
            "org_type": "Cloud Logistics",
            "contact_email": "security@org-b.internal",
            "admin_email": "admin@org-b.internal",
            "password": "Password123!"
        }
    ]

    now_utc = datetime.now(timezone.utc).isoformat()

    for org_data in demo_orgs:
        # Check if org exists
        cursor.execute("SELECT id FROM organizations WHERE identifier = ?", (org_data["identifier"],))
        existing_org = cursor.fetchone()

        if not existing_org:
            cursor.execute("""
                INSERT INTO organizations (name, identifier, org_type, contact_email, status, created_at)
                VALUES (?, ?, ?, ?, 'ACTIVE', ?)
            """, (org_data["name"], org_data["identifier"], org_data["org_type"], org_data["contact_email"], now_utc))
            org_id = cursor.lastrowid
            print(f"Created organization: {org_data['name']} ({org_data['identifier']})")
        else:
            org_id = existing_org["id"]

        # Check if admin user exists
        cursor.execute("SELECT id FROM users WHERE LOWER(email) = ?", (org_data["admin_email"].lower(),))
        existing_user = cursor.fetchone()

        if not existing_user:
            cursor.execute("""
                INSERT INTO users (org_id, email, password_hash, role, created_at)
                VALUES (?, ?, ?, 'ADMIN', ?)
            """, (org_id, org_data["admin_email"], hash_password(org_data["password"]), now_utc))
            print(f"Created admin user: {org_data['admin_email']} (password: {org_data['password']})")

        # Check if keystore exists
        cursor.execute("SELECT id FROM org_keystores WHERE org_identifier = ? AND is_active = 1", (org_data["identifier"],))
        existing_key = cursor.fetchone()

        if not existing_key:
            priv_pem, pub_pem, fingerprint = generate_rsa_keypair(key_size=2048)
            cursor.execute("""
                INSERT INTO org_keystores (org_identifier, key_type, public_key_pem, private_key_pem, key_fingerprint, created_at, is_active)
                VALUES (?, 'RSA-2048', ?, ?, ?, ?, 1)
            """, (org_data["identifier"], pub_pem, priv_pem, fingerprint, now_utc))
            print(f"Generated RSA-2048 keypair for {org_data['identifier']} (Fingerprint: {fingerprint})")

            # Commit local transaction before external registry call
            conn.commit()

            # Publish public key to Trust Registry
            TrustRegistry.publish_identity(org_data["identifier"], org_data["name"], org_data["org_type"], pub_pem)

    # Establish initial mutual federated trust policies
    cursor.execute("""
        INSERT INTO trust_policies (local_org_identifier, peer_org_identifier, is_trusted, trust_level, notes, updated_at)
        VALUES ('ORG-A', 'ORG-B', 1, 'FULL', 'Federated partner trust policy established.', ?)
        ON CONFLICT(local_org_identifier, peer_org_identifier) DO NOTHING
    """, (now_utc,))

    cursor.execute("""
        INSERT INTO trust_policies (local_org_identifier, peer_org_identifier, is_trusted, trust_level, notes, updated_at)
        VALUES ('ORG-B', 'ORG-A', 1, 'FULL', 'Federated partner trust policy established.', ?)
        ON CONFLICT(local_org_identifier, peer_org_identifier) DO NOTHING
    """, (now_utc,))

    conn.commit()
    conn.close()

    print("Seed complete! Demo organizations Organization A and Organization B are ready.")

if __name__ == "__main__":
    seed_database()
