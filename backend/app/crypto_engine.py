import base64
import hashlib
import json
import uuid
from datetime import datetime, timedelta, timezone

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa

def generate_rsa_keypair(key_size=2048):
    """
    Generates a secure RSA keypair.
    Returns:
        private_key_pem (str): PKCS8 PEM representation
        public_key_pem (str): SPKI PEM representation
        fingerprint (str): SHA-256 fingerprint formatted as XX:XX:...
    """
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=key_size,
        backend=default_backend()
    )

    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption()
    ).decode("utf-8")

    public_key = private_key.public_key()
    public_pem = public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo
    ).decode("utf-8")

    fingerprint = compute_public_key_fingerprint(public_pem)

    return private_pem, public_pem, fingerprint

def compute_public_key_fingerprint(public_key_pem):
    """
    Computes a standard colon-delimited SHA-256 fingerprint for a public key.
    """
    public_key = serialization.load_pem_public_key(
        public_key_pem.encode("utf-8"),
        backend=default_backend()
    )
    der_bytes = public_key.public_bytes(
        encoding=serialization.Encoding.DER,
        format=serialization.PublicFormat.SubjectPublicKeyInfo
    )
    digest = hashlib.sha256(der_bytes).hexdigest().upper()
    # Format as XX:XX:XX:...
    return ":".join(digest[i:i+2] for i in range(0, len(digest), 2))

def canonicalize(data_dict):
    """
    Produces deterministic canonical JSON bytes (RFC 8785 style) for signing and verification.
    """
    return json.dumps(data_dict, sort_keys=True, separators=(',', ':')).encode('utf-8')

def sign_payload(private_key_pem, payload_dict):
    """
    Digitally signs a canonical payload using RSA-SHA256 with PKCS#1 v1.5 padding.
    Returns: base64 encoded signature string.
    """
    private_key = serialization.load_pem_private_key(
        private_key_pem.encode("utf-8"),
        password=None,
        backend=default_backend()
    )
    payload_bytes = canonicalize(payload_dict)
    raw_signature = private_key.sign(
        payload_bytes,
        padding.PKCS1v15(),
        hashes.SHA256()
    )
    return base64.b64encode(raw_signature).decode("utf-8")

def verify_payload_signature(public_key_pem, payload_dict, signature_b64):
    """
    Verifies an RSA-SHA256 digital signature over a canonical payload.
    Returns: (bool, str message)
    """
    try:
        public_key = serialization.load_pem_public_key(
            public_key_pem.encode("utf-8"),
            backend=default_backend()
        )
        signature_bytes = base64.b64decode(signature_b64.encode("utf-8"))
        payload_bytes = canonicalize(payload_dict)

        public_key.verify(
            signature_bytes,
            payload_bytes,
            padding.PKCS1v15(),
            hashes.SHA256()
        )
        return True, "Cryptographic signature is mathematically valid."
    except InvalidSignature:
        return False, "Digital signature verification failed: Payload was altered or signature does not match issuer key."
    except Exception as e:
        return False, f"Signature validation error: {str(e)}"

def issue_digital_certificate(
    issuer_org_id,
    issuer_name,
    issuer_private_key_pem,
    issuer_public_key_pem,
    subject_common_name,
    subject_org_id,
    subject_type,
    subject_public_key_pem=None,
    validity_days=365
):
    """
    Constructs and signs an enterprise-grade digital certificate.
    """
    # If no subject public key is provided, generate a dedicated subject keypair for the certificate
    if not subject_public_key_pem:
        _, subject_public_key_pem, _ = generate_rsa_keypair(key_size=2048)

    now = datetime.now(timezone.utc)
    valid_from = now.isoformat()
    valid_to = (now + timedelta(days=validity_days)).isoformat()
    cert_id = f"CERT-{issuer_org_id}-{uuid.uuid4().hex[:8].upper()}"

    issuer_fingerprint = compute_public_key_fingerprint(issuer_public_key_pem)
    subject_fingerprint = compute_public_key_fingerprint(subject_public_key_pem)

    # To-Be-Signed (TBS) Certificate Data
    tbs_certificate = {
        "cert_id": cert_id,
        "version": "1.0",
        "serial_number": str(uuid.uuid4().int)[:16],
        "signature_algorithm": "SHA256withRSA",
        "issuer": {
            "org_identifier": issuer_org_id,
            "org_name": issuer_name,
            "key_fingerprint": issuer_fingerprint
        },
        "subject": {
            "common_name": subject_common_name,
            "org_identifier": subject_org_id,
            "type": subject_type,
            "key_fingerprint": subject_fingerprint
        },
        "subject_public_key_pem": subject_public_key_pem.strip(),
        "validity": {
            "valid_from": valid_from,
            "valid_to": valid_to
        }
    }

    # Digital signature generation
    signature_b64 = sign_payload(issuer_private_key_pem, tbs_certificate)

    full_certificate = {
        "tbs_certificate": tbs_certificate,
        "signature_algorithm": "SHA256withRSA",
        "signature_value": signature_b64,
        "issuer_key_fingerprint": issuer_fingerprint,
        "status": "ACTIVE"
    }

    return full_certificate

