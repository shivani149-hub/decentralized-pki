import sqlite3
from datetime import datetime, timezone
from app.config import Config

def get_db_connection():
    conn = sqlite3.connect(Config.DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Organizations Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS organizations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        identifier TEXT NOT NULL UNIQUE,
        org_type TEXT NOT NULL,
        contact_email TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        created_at TEXT NOT NULL
    );
    """)

    # 2. Users Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        org_id INTEGER NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'ADMIN',
        created_at TEXT NOT NULL,
        FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
    );
    """)

    # 3. Organization Keystore (Private Keystore - Strictly private to each organization)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS org_keystores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        org_identifier TEXT NOT NULL UNIQUE,
        key_type TEXT NOT NULL DEFAULT 'RSA-2048',
        public_key_pem TEXT NOT NULL,
        private_key_pem TEXT NOT NULL,
        key_fingerprint TEXT NOT NULL,
        created_at TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1
    );
    """)

    # 4. Certificates Table (Issued certificates)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS certificates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cert_id TEXT NOT NULL UNIQUE,
        issuer_org_identifier TEXT NOT NULL,
        issuer_name TEXT NOT NULL,
        subject_common_name TEXT NOT NULL,
        subject_org_identifier TEXT NOT NULL,
        subject_type TEXT NOT NULL,
        subject_public_key_pem TEXT NOT NULL,
        valid_from TEXT NOT NULL,
        valid_to TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        signature_algorithm TEXT NOT NULL,
        signature_b64 TEXT NOT NULL,
        certificate_json TEXT NOT NULL,
        created_at TEXT NOT NULL
    );
    """)

    # 5. Decentralized Trust Registry (Public directory of federated identity and issuer public keys)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS trust_registry (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        org_identifier TEXT NOT NULL UNIQUE,
        org_name TEXT NOT NULL,
        org_type TEXT NOT NULL,
        public_key_pem TEXT NOT NULL,
        key_fingerprint TEXT NOT NULL,
        trust_status TEXT NOT NULL DEFAULT 'TRUSTED',
        registered_at TEXT NOT NULL,
        last_updated TEXT NOT NULL
    );
    """)

    # 6. Trust Policies (Configured per organization - determines which peer organizations it trusts)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS trust_policies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        local_org_identifier TEXT NOT NULL,
        peer_org_identifier TEXT NOT NULL,
        is_trusted INTEGER NOT NULL DEFAULT 1,
        trust_level TEXT NOT NULL DEFAULT 'FULL',
        notes TEXT,
        updated_at TEXT NOT NULL,
        UNIQUE(local_org_identifier, peer_org_identifier)
    );
    """)

    # 7. Revocation Records (Authoritative revocation log)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS revocation_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cert_id TEXT NOT NULL UNIQUE,
        revoked_by_org TEXT NOT NULL,
        revocation_reason TEXT NOT NULL,
        revoked_at TEXT NOT NULL,
        revocation_signature TEXT NOT NULL
    );
    """)

    # 8. Audit Logs Table (Tamper-evident record of all security actions)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        org_identifier TEXT NOT NULL,
        user_email TEXT,
        event_type TEXT NOT NULL,
        certificate_id TEXT,
        result TEXT NOT NULL,
        details TEXT,
        ip_address TEXT
    );
    """)

    conn.commit()
    conn.close()

def log_audit_event(org_identifier, event_type, result, certificate_id=None, user_email=None, details=None, ip_address="127.0.0.1"):
    """
    Appends a new security event to the audit log.
    Audit records cannot be edited or deleted through normal user operations.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    now_utc = datetime.now(timezone.utc).isoformat()
    cursor.execute("""
        INSERT INTO audit_logs (timestamp, org_identifier, user_email, event_type, certificate_id, result, details, ip_address)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (now_utc, org_identifier, user_email, event_type, certificate_id, result, str(details or ""), ip_address))
    conn.commit()
    conn.close()

