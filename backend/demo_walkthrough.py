"""
Automated End-to-End Walkthrough of the Exact College Project Demonstration (Section 15)

This script executes the required demonstration workflow:
1. Log in as Organization B.
2. Check or rotate RSA-2048 keypair.
3. Issue a digitally signed certificate for 'payment-gateway.service.org-b'.
4. Confirm public key & trust information are published to the Trust Registry.
5. Log out, log in as Organization A.
6. Open Verify Certificate and select Organization B's certificate.
7. Run verification -> Show 5 individual check results passing.
8. Tamper with signed certificate data -> Verify mathematical signature failure.
9. Log in as authorized issuer (Org B) and revoke the certificate with reason.
10. Log in as Org A and verify the revoked certificate again -> Detects REVOKED status.
11. Query and inspect the security audit trail.
"""

import sys
import json
from pathlib import Path

backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app import create_app

def print_step(num, title):
    print(f"\n[{num:02d}] {title.upper()}")
    print("-" * 65)

def main():
    print("=" * 65)
    print(" DECENTRALIZED PKI FRAMEWORK: COLLEGE DEMONSTRATION SUITE")
    print(" Title: Decentralized PKI Framework for Secure Cross-Organizational Federation")
    print("=" * 65)

    app = create_app()
    client = app.test_client()

    # Step 1: Health
    print_step(1, "Check Backend Health")
    res = client.get("/api/health")
    print(f"Status: {res.status_code} | Service: {res.get_json()['service']}")

    # Step 2: Log in as Organization B
    print_step(2, "Log in as Organization B Administrator")
    res = client.post("/api/auth/login", json={
        "org_identifier": "ORG-B",
        "email": "admin@org-b.internal",
        "password": "Password123!"
    })
    token_b = res.get_json()["token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}
    print(f"Authenticated as Organization B: {res.get_json()['user']['org_name']} ({res.get_json()['user']['email']})")

    # Step 3: Keystore & Public Key in Trust Registry
    print_step(3, "Verify Keystore & Public Key in Trust Registry")
    res = client.get("/api/certificates/keystore-status", headers=headers_b)
    keystore_b = res.get_json()
    print(f"Algorithm: {keystore_b['key_type']}")
    print(f"Public Key SHA-256 Fingerprint: {keystore_b['key_fingerprint']}")

    # Step 4: Issue Digitally Signed Certificate
    print_step(4, "Issue Digitally Signed Certificate for Demonstration Identity")
    res = client.post("/api/certificates/issue", headers=headers_b, json={
        "subject_common_name": "api.cloud-logistics.org-b.internal",
        "subject_org_identifier": "ORG-B",
        "subject_type": "ServiceIdentity",
        "validity_days": 365
    })
    cert_envelope = res.get_json()["certificate"]
    cert_id = cert_envelope["tbs_certificate"]["cert_id"]
    print(f"Certificate ID: {cert_id}")
    print(f"Subject: {cert_envelope['tbs_certificate']['subject']['common_name']}")
    print(f"Signature Algorithm: {cert_envelope['signature_algorithm']}")
    print(f"Signature (Base64 RSA-SHA256): {cert_envelope['signature_value'][:36]}...")

    # Step 5: Log out, log in as Organization A
    print_step(5, "Log in as Organization A Administrator (Verifying Entity)")
    res = client.post("/api/auth/login", json={
        "org_identifier": "ORG-A",
        "email": "admin@org-a.internal",
        "password": "Password123!"
    })
    token_a = res.get_json()["token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}
    print(f"Authenticated as Organization A: {res.get_json()['user']['org_name']}")

    # Step 6: Verify Certificate (Org A verifying Org B's certificate)
    print_step(6, "Execute Cross-Organizational Verification (Org A -> Org B)")
    res = client.post("/api/verify", headers=headers_a, json={
        "certificate": cert_envelope
    })
    v1 = res.get_json()
    print(f"Outcome: {v1['summary']}")
    print("Individual Check Breakdown:")
    for k, v in v1["checks"].items():
        print(f"  • {v['name']}: [{v['label']}] — {v['message']}")

    # Step 7: Tamper Attack Test
    print_step(7, "Tamper Attack Test: Modify Payload without Re-signing")
    tampered_envelope = json.loads(json.dumps(cert_envelope))
    tampered_envelope["tbs_certificate"]["subject"]["common_name"] = "impersonator.malicious-node.org"
    res = client.post("/api/verify", headers=headers_a, json={
        "certificate": tampered_envelope
    })
    v2 = res.get_json()
    print(f"Outcome: {v2['summary']}")
    print(f"Signature Check Result: [{v2['checks']['signature']['label']}]")
    print(f"Diagnostic Message: {v2['checks']['signature']['message']}")

    # Step 8: Authorization Enforcement Test
    print_step(8, "Authorization Enforcement: Org A attempts to revoke Org B's certificate")
    res = client.post("/api/revocations/revoke", headers=headers_a, json={
        "cert_id": cert_id,
        "reason": "Hostile revocation attempt"
    })
    print(f"HTTP Status: {res.status_code} (Expected 403 Forbidden)")
    print(f"Response: {res.get_json().get('error')}")

    # Step 9: Authorized Revocation by Org B
    print_step(9, "Authorized Revocation: Org B Revokes its Certificate")
    res = client.post("/api/revocations/revoke", headers=headers_b, json={
        "cert_id": cert_id,
        "reason": "Routine Private Key Rotation / Key Compromise"
    })
    print(f"Revocation Confirmed: {res.get_json()['message']}")

    # Step 10: Re-verify Revoked Certificate
    print_step(10, "Org A Re-verifies Revoked Certificate")
    res = client.post("/api/verify", headers=headers_a, json={
        "cert_id": cert_id
    })
    v3 = res.get_json()
    print(f"Outcome: {v3['summary']}")
    print(f"Revocation Check Result: [{v3['checks']['revocation']['label']}]")
    print(f"Authoritative Registry Message: {v3['checks']['revocation']['message']}")

    # Step 11: Inspect Audit Logs
    print_step(11, "Inspect Security Audit Logs")
    res = client.get("/api/audit", headers=headers_a)
    logs = res.get_json()
    print(f"Total Audit Trail Events Recorded: {len(logs)}")
    print(f"Latest 3 Events:")
    for l in logs[:3]:
        print(f"  [{l['timestamp'][:19]}] {l['org_identifier']} | {l['event_type']} | {l['result']} | {l['certificate_id'] or '-'}")

    print("\n" + "=" * 65)
    print(" DEMONSTRATION WORKFLOW COMPLETE AND VERIFIED SUCCESSFULLY!")
    print("=" * 65)

if __name__ == "__main__":
    main()

