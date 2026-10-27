import sys
from pathlib import Path
import json

backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app import create_app

def run_all_tests():
    print("==================================================")
    print("STARTING DECENTRALIZED PKI AUTOMATED TEST SUITE")
    print("==================================================")

    app = create_app()
    client = app.test_client()

    # 1. Health Check
    res = client.get("/api/health")
    assert res.status_code == 200, f"Health check failed: {res.status_code}"
    print("[PASS] 1. API Health Check")

    # 2. Demo Organizations
    res = client.get("/api/auth/demo-organizations")
    assert res.status_code == 200, f"Demo orgs failed: {res.status_code}"
    orgs = res.get_json()
    assert len(orgs) >= 2, f"Expected at least 2 demo orgs, got {len(orgs)}"
    print(f"[PASS] 2. Demo Organizations available: {[o['identifier'] for o in orgs]}")

    # 3. Login as Organization B
    res = client.post("/api/auth/login", json={
        "org_identifier": "ORG-B",
        "email": "admin@org-b.internal",
        "password": "Password123!"
    })
    assert res.status_code == 200, f"Login Org B failed: {res.get_json()}"
    org_b_token = res.get_json()["token"]
    org_b_headers = {"Authorization": f"Bearer {org_b_token}"}
    print("[PASS] 3. Login as Organization B admin successful")

    # 4. Check Keystore & Key Generation for Org B
    res = client.get("/api/certificates/keystore-status", headers=org_b_headers)
    assert res.status_code == 200
    keystore_info = res.get_json()
    assert keystore_info["has_keypair"] is True
    print(f"[PASS] 4. Org B Keystore active (Fingerprint: {keystore_info['key_fingerprint'][:20]}...)")

    # 5. Org B Issues Digitally Signed Certificate
    res = client.post("/api/certificates/issue", headers=org_b_headers, json={
        "subject_common_name": "payment-gateway.service.org-b",
        "subject_org_identifier": "ORG-B",
        "subject_type": "ServiceIdentity",
        "validity_days": 365
    })
    assert res.status_code == 201, f"Cert issuance failed: {res.get_json()}"
    cert_envelope = res.get_json()["certificate"]
    cert_id = cert_envelope["tbs_certificate"]["cert_id"]
    print(f"[PASS] 5. Org B issued certificate: {cert_id}")

    # 6. Login as Organization A
    res = client.post("/api/auth/login", json={
        "org_identifier": "ORG-A",
        "email": "admin@org-a.internal",
        "password": "Password123!"
    })
    assert res.status_code == 200, f"Login Org A failed: {res.get_json()}"
    org_a_token = res.get_json()["token"]
    org_a_headers = {"Authorization": f"Bearer {org_a_token}"}
    print("[PASS] 6. Login as Organization A admin successful")

    # 7. Org A Verifies Org B's Certificate (Untampered)
    res = client.post("/api/verify", headers=org_a_headers, json={
        "certificate": cert_envelope
    })
    assert res.status_code == 200, f"Verification request failed: {res.get_json()}"
    v_result = res.get_json()
    assert v_result["overall_status"] == "PASSED", f"Expected PASSED, got: {v_result}"
    assert v_result["checks"]["signature"]["status"] == "PASSED"
    assert v_result["checks"]["issuer_trust"]["status"] == "PASSED"
    assert v_result["checks"]["expiry"]["status"] == "PASSED"
    assert v_result["checks"]["revocation"]["status"] == "PASSED"
    print(f"[PASS] 7. Org A successfully verified Org B's certificate (All 5 checks PASSED)")

    # 8. Tamper Verification Test: Alter subject data without re-signing
    tampered_envelope = json.loads(json.dumps(cert_envelope))
    tampered_envelope["tbs_certificate"]["subject"]["common_name"] = "malicious-impersonator.attacker"
    res = client.post("/api/verify", headers=org_a_headers, json={
        "certificate": tampered_envelope
    })
    assert res.status_code == 200
    tamper_result = res.get_json()
    assert tamper_result["overall_status"] == "FAILED", "Expected verification to fail on tampered data!"
    assert tamper_result["checks"]["signature"]["status"] == "FAILED"
    print(f"[PASS] 8. Tamper Detection Verified: Altered certificate payload was rejected mathematically ({tamper_result['checks']['signature']['label']})")

    # 9. Authorization Test: Org A tries to revoke Org B's certificate -> MUST BE DENIED
    res = client.post("/api/revocations/revoke", headers=org_a_headers, json={
        "cert_id": cert_id,
        "reason": "Unauthorized revocation attempt"
    })
    assert res.status_code == 403, f"Expected 403 Forbidden for unauthorized revocation, got: {res.status_code}"
    print(f"[PASS] 9. Authorization Enforced: Org A was blocked from revoking Org B's certificate (403 Forbidden)")

    # 10. Authorized Revocation: Org B revokes its own certificate
    res = client.post("/api/revocations/revoke", headers=org_b_headers, json={
        "cert_id": cert_id,
        "reason": "Private Key Compromise / Routine Retirement"
    })
    assert res.status_code == 200, f"Authorized revocation failed: {res.get_json()}"
    print(f"[PASS] 10. Org B authoritatively revoked certificate {cert_id}")

    # 11. Org A re-verifies the revoked certificate -> MUST DETECT REVOKED STATUS
    res = client.post("/api/verify", headers=org_a_headers, json={
        "cert_id": cert_id
    })
    assert res.status_code == 200
    rev_verify = res.get_json()
    assert rev_verify["overall_status"] == "FAILED"
    assert rev_verify["checks"]["revocation"]["status"] == "FAILED"
    assert rev_verify["checks"]["revocation"]["label"] == "Revoked"
    print(f"[PASS] 11. Revocation Detected: Subsequent verification detected REVOKED status in trust registry")

    # 12. Check Audit Logs
    res = client.get("/api/audit", headers=org_a_headers)
    assert res.status_code == 200
    logs = res.get_json()
    assert len(logs) > 5, "Expected recorded audit events"
    print(f"[PASS] 12. Audit Trail Verified ({len(logs)} security events recorded)")

    print("==================================================")
    print("ALL DECENTRALIZED PKI CORE WORKFLOW TESTS PASSED!")
    print("==================================================")

if __name__ == "__main__":
    run_all_tests()

