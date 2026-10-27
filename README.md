# Decentralized PKI Framework for Secure Cross-Organizational Federation

An enterprise-grade prototype demonstrating a decentralized Public Key Infrastructure (PKI) framework for cross-organizational trust and cryptographic certificate verification.

---

## 1. Project Overview

In traditional enterprise IT environments, establishing digital identity trust between distinct organizations (such as **Organization A** and **Organization B**) often relies on centralized third-party Certificate Authorities (CAs) or ad-hoc file transfers.

This project implements a **Decentralized PKI Framework** where:
1. Each organization generates and manages its own cryptographic keys privately (private keys never leave the organization's local keystore).
2. Organizations issue digitally signed certificates for their internal services, machine nodes, and identities.
3. A shared, federated **Trust Registry** distributes public keys, cryptographic fingerprints, and authoritative revocation records.
4. Organizations verify peer certificates independently using mathematical cryptography, validity policies, and revocation registries without sharing sensitive secrets.

---

## 2. Architecture & Logical Components

```
+---------------------------------------------------------------------------------+
|                        DECENTRALIZED PKI FEDERATION                             |
+---------------------------------------------------------------------------------+
|                                                                                 |
|   +-----------------------+                         +-----------------------+   |
|   |    ORGANIZATION A     |                         |    ORGANIZATION B     |   |
|   |                       |                         |                       |   |
|   | [Local Private Keys]  |                         | [Local Private Keys]  |   |
|   |  (RSA-2048 Keystore)  |                         |  (RSA-2048 Keystore)  |   |
|   |                       |                         |                       |   |
|   | • Signs Certificates  |                         | • Signs Certificates  |   |
|   | • Verifies Peer Certs |                         | • Verifies Peer Certs |   |
|   | • Sets Trust Policies |                         | • Sets Trust Policies |   |
|   +-----------+-----------+                         +-----------+-----------+   |
|               |                                                 |               |
|               |     +-------------------------------------+     |               |
|               +---->|     SHARED TRUST REGISTRY / LEDGER  |<----+               |
|                     |                                     |                     |
|                     | • Public Keys & SHA-256 Fingerprints|                     |
|                     | • Authoritative Revocation Records  |                     |
|                     | • Federated Member Directory        |                     |
|                     +-------------------------------------+                     |
|                                        |                                        |
|                     +-------------------------------------+                     |
|                     |       IMMUTABLE AUDIT LOG           |                     |
|                     |  (Append-only Security Event Trail) |                     |
|                     +-------------------------------------+                     |
+---------------------------------------------------------------------------------+
```

### Logical Components
1. **Cryptographic Engine (`crypto_engine.py`)**:
   - Generates authentic 2048-bit RSA keypairs using Python's `cryptography` library.
   - Signs To-Be-Signed (TBS) canonical certificate data using RSA-SHA256 with PKCS#1 v1.5 padding.
   - Produces colon-delimited SHA-256 fingerprints of public keys (`SubjectPublicKeyInfo`).
   - Verifies digital signatures mathematically. Any 1-bit tampering with the certificate immediately invalidates the signature.

2. **Decentralized Trust Registry (`trust_registry.py`)**:
   - The authoritative public directory of registered organizations, their public keys, and revocation entries.
   - Provides clean interfaces for publishing identities, looking up peer issuer public keys, and checking revocation status.

3. **Authentication & Authorization Engine (`auth.py`)**:
   - Secure PBKDF2-SHA256 password hashing.
   - Short-lived JWT session tokens encoding organization ID and role.
   - Role-based authorization preventing unauthorized organizations from revoking peer certificates.

4. **Cross-Organizational 5-Check Verification Engine (`verify_routes.py`)**:
   Whenever Organization A verifies a certificate issued by Organization B, 5 independent checks are executed:
   - **Check 1: Structure & Schema Validation**: Verifies that required fields (`cert_id`, `issuer`, `subject`, `validity`, `signature_value`) exist and adhere to schema.
   - **Check 2: Digital Signature Verification**: Reconstructs canonical JSON bytes and validates the mathematical signature against the issuer's public key obtained from the Trust Registry.
   - **Check 3: Issuer Trust Validation**: Verifies that the issuing organization is registered in the federation and accepted by the local organization's configured trust policy.
   - **Check 4: Validity Period Checking**: Confirms that current UTC time falls strictly between `valid_from` and `valid_to`.
   - **Check 5: Revocation Status Checking**: Confirms that the certificate ID does not appear in the authoritative revocation list.

5. **Authoritative Revocation Service (`revocation_routes.py`)**:
   - Enables authorized issuers to revoke certificates with RFC 5280 standard reasons (e.g. *Key Compromise*, *Superseded*).
   - Enforces strict cross-organizational access control: Organization A cannot revoke Organization B's certificates.

6. **Immutable Audit Trail (`audit_routes.py`)**:
   - Append-only security logging for every login, key generation, issuance, verification attempt, policy change, and revocation.

---

## 3. Technology Stack

- **Frontend**: React 18, Vite 5, Lucide-react (line icons), Vanilla CSS adhering strictly to the enterprise theme.
- **Backend**: Python 3.12, Flask 3.0, Flask-CORS, PyJWT, Werkzeug.
- **Cryptographic Library**: `cryptography` (Python maintained cryptographic standard).
- **Database**: SQLite 3 with foreign key enforcement and row factory.

---

## 4. Visual Design Specifications

The user interface adheres to strict enterprise IT administration standards:
- **Sidebar Background**: Dark Slate Blue (`#394B64`)
- **Sidebar Text**: Soft White (`#F5F6F8`)
- **Main Page Background**: Very Light Grey (`#F7F8FA`)
- **Content Panels & Tables**: Crisp White (`#FFFFFF`)
- **Borders & Separators**: Light Grey (`#D9DDE3`)
- **Primary Text**: Dark Charcoal (`#252B35`)
- **Secondary Text**: Medium Grey (`#707783`)
- **Verified / Active Status**: Muted Green (`#1E6B24` on `#EAF7EC`)
- **Failed / Revoked Status**: Muted Red (`#B71C1C` on `#FDEDEE`)
- **Pending Status**: Muted Amber (`#B25900` on `#FFF5E6`)

---

## 5. Folder & File Structure

```
mini project/
├── backend/
│   ├── app/
│   │   ├── __init__.py           # Flask app factory, static frontend routing, CORS
│   │   ├── auth.py               # PBKDF2 hashing, JWT tokens, auth decorators
│   │   ├── config.py             # Environment configuration, database paths
│   │   ├── crypto_engine.py      # RSA-2048 keygen, canonical signing, signature verification
│   │   ├── models.py             # SQLite database schemas and audit logger
│   │   ├── trust_registry.py     # Decentralized Trust Registry interface & operations
│   │   └── routes/
│   │       ├── auth_routes.py       # Login, Organization registration, Profile
│   │       ├── dashboard_routes.py  # Summary metrics and recent activity
│   │       ├── cert_routes.py       # Keystore status, keygen, cert issuance, listing
│   │       ├── verify_routes.py     # 5-check cross-organizational verification engine
│   │       ├── revocation_routes.py # Authoritative revocation with authorization enforcement
│   │       ├── audit_routes.py      # Filterable read-only audit log
│   │       └── trust_routes.py      # Trust policies and federated nodes
│   ├── data/
│   │   └── dpki_database.db      # SQLite persistent database
│   ├── demo_walkthrough.py       # Step-by-step automated demonstration script
│   ├── requirements.txt          # Python dependencies
│   ├── run.py                    # Backend server entrypoint (port 5000)
│   ├── seed.py                   # Initial database seeder (Org A and Org B accounts)
│   └── test_api.py               # Comprehensive automated test suite
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ConfirmationModal.jsx # Enterprise confirmation dialog
│   │   │   ├── Sidebar.jsx           # Fixed dark slate-blue navigation sidebar
│   │   │   ├── StatusBadge.jsx       # Restrained enterprise status badges
│   │   │   └── TopNavbar.jsx         # Clean white header with org badge & profile
│   │   ├── pages/
│   │   │   ├── AuditLogsPage.jsx     # Security event audit trail with filters
│   │   │   ├── CertificatesPage.jsx  # Keystore info, issuance modal, cert list
│   │   │   ├── DashboardPage.jsx     # Summary cards & recent activity table
│   │   │   ├── LoginPage.jsx         # Minimal login with Organization selector
│   │   │   ├── OrganizationsPage.jsx # Federated node directory
│   │   │   ├── RegisterPage.jsx      # Organization registration & onboarding
│   │   │   ├── RevocationPage.jsx    # Authoritative revocation console
│   │   │   ├── SettingsPage.jsx      # Peer trust policy matrix
│   │   │   └── VerifyCertPage.jsx    # 5-check verification engine & tamper test
│   │   ├── services/
│   │   │   └── api.js                # Centralized API fetch wrapper with JWT
│   │   ├── App.jsx                   # Navigation state & layout shell
│   │   ├── index.css                 # Enterprise design system styles
│   │   └── main.jsx                  # React application entrypoint
│   ├── index.html                    # HTML root template
│   ├── package.json                  # Frontend dependencies and scripts
│   └── vite.config.js                # Vite build and proxy config
└── README.md                         # Comprehensive documentation
```

---

## 6. Installation & Setup Instructions

### Prerequisites
- Python 3.10+ (Tested on Python 3.12)
- Node.js 18+ and npm

### Step 1: Initialize Database & Seed Demonstration Accounts
Open a terminal in the project directory:

```bash
# 1. Run the database seed script using Python virtual environment:
backend\venv\Scripts\python backend\seed.py
```

This creates the SQLite database and seeds two demonstration entities:
- **Organization A**:
  - Organization ID: `ORG-A`
  - Admin Email: `admin@org-a.internal`
  - Password: `Password123!`
- **Organization B**:
  - Organization ID: `ORG-B`
  - Admin Email: `admin@org-b.internal`
  - Password: `Password123!`

---

## 7. Starting the Application

You can run the application in two convenient ways:

### Option A (Single Server — Recommended):
The Flask backend has been configured to serve both the REST API and the compiled React production frontend directly on port 5000:

```bash
backend\venv\Scripts\python backend\run.py
```
Then open your web browser at:
👉 **`http://127.0.0.1:5000`**

### Option B (Development Mode with Live Reload):
If you want to edit frontend components live with hot-module reloading:

**Terminal 1 (Backend):**
```bash
backend\venv\Scripts\python backend\run.py
```

**Terminal 2 (Frontend):**
```bash
npm --prefix frontend run dev
```
Then open your web browser at:
👉 **`http://localhost:3000`**

---

## 8. College Final Review Demonstration Workflow

Follow these exact steps during your demonstration to showcase all key requirements:

1. **Open the Login Page**:
   - Notice the minimal enterprise login panel (no decorative graphics, no promotional banners).
   - Use the Organization selector to select **Organization B**.
   - Sign in with `admin@org-b.internal` / `Password123!` (or click the quick "Org B (Demo)" button).

2. **Inspect Keystore & Issue Certificate**:
   - Navigate to **Certificates**.
   - Notice the active **RSA-2048 Keystore** status bar with Organization B's SHA-256 public key fingerprint.
   - Click **Issue Certificate**.
   - Enter Subject Common Name: `api.cloud-logistics.org-b.internal`.
   - Select Subject Type: `ServiceIdentity`.
   - Click **Sign & Issue Certificate**.
   - Notice the newly issued certificate appears with `ACTIVE` status. Click the **Eye icon** to inspect the digital signature and To-Be-Signed (TBS) canonical JSON structure.

3. **Log Out and Log In as Organization A**:
   - Click **Logout** at the bottom of the sidebar.
   - Select **Organization A** in the dropdown.
   - Sign in with `admin@org-a.internal` / `Password123!`.

4. **Execute Cross-Organizational Verification**:
   - Navigate to **Verify Certificate**.
   - Under *Registry Records*, select the certificate just issued by Organization B.
   - Click **Verify Certificate**.
   - Observe the green **VERIFICATION PASSED** banner and the breakdown of all 5 independent checks:
     1. *Certificate Structure & Schema*: Valid
     2. *Digital Signature*: Valid (verified with Organization B's public key from Trust Registry)
     3. *Issuer Trust & Policy*: Trusted (Organization B is trusted under federation policy)
     4. *Validity Period*: Valid (within active validity window)
     5. *Revocation Status*: Not Revoked

5. **Demonstrate Tamper Attack Detection**:
   - Switch the verification input mode to **Raw JSON / Upload**.
   - Click the amber button: **Tamper with Payload (Test)**.
   - Notice how the subject identity is subtly altered (e.g. to `...-tampered.attacker`).
   - Click **Verify Certificate**.
   - Observe the red **VERIFICATION FAILED** banner. The **Digital Signature Verification** check immediately flags `Invalid`, demonstrating that even a 1-character unauthorized alteration is caught mathematically.

6. **Demonstrate Authorization Enforcement**:
   - Navigate to **Revocation**.
   - While still logged in as **Organization A**, attempt to revoke Organization B's certificate.
   - Notice the backend blocks the action with a clear **403 Forbidden / Authorization Denied** message, confirming that only the issuing organization can revoke its own credentials.

7. **Execute Authorized Revocation**:
   - Log out, and log back in as **Organization B**.
   - Navigate to **Revocation**.
   - Select the original certificate from the dropdown.
   - Select Reason: `Key Compromise` and click **Revoke Certificate**.
   - Confirm the action in the compact dialog.

8. **Confirm Revocation Detection**:
   - Log back in as **Organization A** and return to **Verify Certificate**.
   - Select the same certificate and click **Verify Certificate**.
   - Observe the **VERIFICATION FAILED** outcome: Check #5 (*Revocation Status*) identifies that the certificate was revoked by Organization B.

9. **Review Security Audit Trail**:
   - Navigate to **Audit Logs**.
   - Inspect the complete timestamped history of all actions: issuance, verification passes, tamper detections, unauthorized attempts, and authoritative revocations.

---

## 9. Automated Testing

You can run the full automated test suite anytime with a single command:

```bash
# Run the 12-test automated validation suite:
backend\venv\Scripts\python backend\test_api.py

# Or run the complete demonstration walkthrough with formatted terminal output:
backend\venv\Scripts\python backend\demo_walkthrough.py
```

---

## 10. Scope & Known Limitations

For the scope of this college prototype:
- **Trust Registry Implementation**: In this local prototype, the Trust Registry is implemented as a shared relational schema and interface. In a production decentralized PKI deployment across physical enterprises, this layer would be backed by a Byzantine fault-tolerant distributed ledger (such as Hyperledger Fabric or an Ethereum consortium smart contract) or a peer-to-peer gossip protocol.
- **Audit Logs**: Stored as an append-only database table with SHA-256 event fingerprinting. For mission-critical deployments, audit entries would be anchored to an immutable cryptographic Merkle tree or public transparency log (similar to Certificate Transparency / RFC 6962).

