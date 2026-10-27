import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Upload, 
  FileText, 
  RefreshCw, 
  ChevronDown, 
  ChevronRight,
  Shield,
  Layers,
  Sparkles
} from 'lucide-react';
import { api } from '../services/api';
import StatusBadge from '../components/StatusBadge';

export default function VerifyCertPage({ initialCertificate, user }) {
  const [certInputMode, setCertInputMode] = useState('select'); // 'select' | 'json'
  const [availableCerts, setAvailableCerts] = useState([]);
  const [selectedCertId, setSelectedCertId] = useState('');
  const [jsonText, setJsonText] = useState('');
  const [isTampered, setIsTampered] = useState(false);
  const [originalBackupJson, setOriginalBackupJson] = useState('');

  const [loadingCerts, setLoadingCerts] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [error, setError] = useState('');
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  // Load certificates list for the selector
  const loadCerts = async () => {
    setLoadingCerts(true);
    try {
      const certs = await api.getCertificates();
      setAvailableCerts(certs);

      if (initialCertificate) {
        if (typeof initialCertificate === 'string') {
          setSelectedCertId(initialCertificate);
        } else if (typeof initialCertificate === 'object') {
          const formatted = JSON.stringify(initialCertificate, null, 2);
          setJsonText(formatted);
          setOriginalBackupJson(formatted);
          setCertInputMode('json');
        }
      } else if (certs.length > 0 && !selectedCertId) {
        setSelectedCertId(certs[0].cert_id);
      }
    } catch (err) {
      setError('Failed to load certificates registry.');
    } finally {
      setLoadingCerts(false);
    }
  };

  useEffect(() => {
    loadCerts();
  }, []);

  const handleSelectCertChange = async (certId) => {
    setSelectedCertId(certId);
    setVerificationResult(null);
    setIsTampered(false);
    setError('');

    if (certId) {
      try {
        const details = await api.getCertificateDetails(certId);
        const formatted = JSON.stringify(details.full_envelope || JSON.parse(details.certificate_json || '{}'), null, 2);
        setJsonText(formatted);
        setOriginalBackupJson(formatted);
      } catch {
        // keep selectedCertId
      }
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target.result;
        JSON.parse(content); // Validate JSON format
        setJsonText(content);
        setOriginalBackupJson(content);
        setIsTampered(false);
        setCertInputMode('json');
        setVerificationResult(null);
        setError('');
      } catch (err) {
        setError('Uploaded file is not a valid JSON certificate.');
      }
    };
    reader.readAsText(file);
  };

  // Tamper simulation for testing
  const handleTamperPayload = () => {
    try {
      let parsed = JSON.parse(jsonText || '{}');
      if (parsed.tbs_certificate) {
        // Alter subject common name or serial number
        const originalName = parsed.tbs_certificate.subject?.common_name || 'service';
        parsed.tbs_certificate.subject.common_name = `${originalName}-tampered.attacker`;
      } else {
        parsed.tampered_field = 'altered_data';
      }
      setJsonText(JSON.stringify(parsed, null, 2));
      setIsTampered(true);
      setVerificationResult(null);
    } catch {
      setError('Cannot tamper invalid JSON.');
    }
  };

  const handleResetTamper = () => {
    if (originalBackupJson) {
      setJsonText(originalBackupJson);
      setIsTampered(false);
      setVerificationResult(null);
    }
  };

  const handleRunVerification = async () => {
    setVerifying(true);
    setError('');
    setVerificationResult(null);

    try {
      let payload = {};
      if (certInputMode === 'json' || isTampered) {
        if (!jsonText.trim()) {
          setError('Please provide a certificate JSON.');
          setVerifying(false);
          return;
        }
        let certObj;
        try {
          certObj = JSON.parse(jsonText);
        } catch {
          setError('Invalid JSON syntax in certificate input.');
          setVerifying(false);
          return;
        }
        payload = { certificate: certObj };
      } else {
        if (!selectedCertId) {
          setError('Please select a certificate to verify.');
          setVerifying(false);
          return;
        }
        payload = { cert_id: selectedCertId };
      }

      const result = await api.verifyCertificate(payload);
      setVerificationResult(result);
    } catch (err) {
      setError(err.message || 'Verification execution failed.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>Cross-Organizational Certificate Verification</h1>
          <p>Multi-factor cryptographic trust and validity verification engine</p>
        </div>
      </div>

      {error && (
        <div style={{
          backgroundColor: '#FDEDEE',
          border: '1px solid #F8B4B8',
          color: '#B71C1C',
          padding: '10px 14px',
          borderRadius: '4px',
          fontSize: '12.5px',
          marginBottom: '16px'
        }}>
          {error}
        </div>
      )}

      {/* Verification Input Panel */}
      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">
            <Layers size={14} color="#394B64" />
            <span>Select or Provide Certificate for Verification</span>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              type="button"
              onClick={() => { setCertInputMode('select'); setVerificationResult(null); }}
              className={`btn btn-sm ${certInputMode === 'select' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '11.5px', padding: '3px 9px' }}
            >
              Registry Records
            </button>
            <button
              type="button"
              onClick={() => { setCertInputMode('json'); setVerificationResult(null); }}
              className={`btn btn-sm ${certInputMode === 'json' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '11.5px', padding: '3px 9px' }}
            >
              Raw JSON / Upload
            </button>
          </div>
        </div>

        <div className="panel-body">
          {certInputMode === 'select' ? (
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#4C5564', marginBottom: '6px' }}>
                Available Federated Certificates in Registry
              </label>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <select
                  value={selectedCertId}
                  onChange={(e) => handleSelectCertChange(e.target.value)}
                  style={{ maxWidth: '500px' }}
                  disabled={verifying || loadingCerts}
                >
                  <option value="">-- Select Certificate to Verify --</option>
                  {availableCerts.map((c) => (
                    <option key={c.cert_id} value={c.cert_id}>
                      {c.cert_id} — Subject: {c.subject_common_name} (Issuer: {c.issuer_org_identifier}) [{c.status}]
                    </option>
                  ))}
                </select>

                <button
                  onClick={loadCerts}
                  className="btn btn-secondary btn-sm"
                  type="button"
                  title="Refresh list"
                >
                  <RefreshCw size={13} className={loadingCerts ? 'spin' : ''} />
                </button>
              </div>

              {selectedCertId && (
                <div style={{ marginTop: '12px', fontSize: '11.5px', color: '#707783' }}>
                  Verification will be executed from perspective of <strong>{user?.org_name} ({user?.org_identifier})</strong> using the public keys published in the federated Trust Registry.
                </div>
              )}
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#4C5564' }}>
                  Signed Certificate JSON Structure
                </label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', fontSize: '11.5px', padding: '3px 8px' }}>
                    <Upload size={12} />
                    <span>Upload File</span>
                    <input type="file" accept=".json" onChange={handleFileUpload} style={{ display: 'none' }} />
                  </label>

                  {!isTampered ? (
                    <button
                      type="button"
                      onClick={handleTamperPayload}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '11.5px', padding: '3px 8px', borderColor: '#E0A800', color: '#856404' }}
                      title="Alter subject payload without re-signing to test cryptographic detection"
                    >
                      <AlertTriangle size={12} color="#856404" />
                      <span>Tamper with Payload (Test)</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResetTamper}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '11.5px', padding: '3px 8px' }}
                    >
                      <span>Reset to Original</span>
                    </button>
                  )}
                </div>
              </div>

              {isTampered && (
                <div style={{
                  backgroundColor: '#FFF5E6',
                  border: '1px solid #FFD499',
                  color: '#B25900',
                  padding: '8px 12px',
                  borderRadius: '3px',
                  fontSize: '11.5px',
                  marginBottom: '10px'
                }}>
                  <strong>Tamper Flag Active:</strong> The certificate payload has been modified. Digital signature validation should reject this certificate mathematically!
                </div>
              )}

              <textarea
                rows={10}
                className="mono"
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                placeholder="Paste signed certificate JSON envelope here..."
                style={{ fontSize: '11.5px', lineHeight: '1.4' }}
              />
            </div>
          )}

          {/* Action Row */}
          <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button
              type="button"
              onClick={handleRunVerification}
              className="btn btn-primary"
              disabled={verifying || (!selectedCertId && !jsonText)}
              style={{ padding: '8px 18px' }}
            >
              <ShieldCheck size={15} />
              <span>{verifying ? 'Running Cryptographic Verification...' : 'Verify Certificate'}</span>
            </button>

            <span style={{ fontSize: '11.5px', color: '#707783' }}>
              Performs 5 independent checks: Schema, Signature, Policy, Window, Revocation.
            </span>
          </div>
        </div>
      </div>

      {/* Verification Result Display */}
      {verificationResult && (
        <div className="panel" style={{ marginTop: '22px' }}>
          {/* Main Outcome Header */}
          <div style={{
            padding: '16px 20px',
            backgroundColor: verificationResult.overall_status === 'PASSED' ? '#EAF7EC' : '#FDEDEE',
            borderBottom: `1px solid ${verificationResult.overall_status === 'PASSED' ? '#C3E7C6' : '#F8B4B8'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {verificationResult.overall_status === 'PASSED' ? (
                <CheckCircle2 size={24} color="#1E6B24" />
              ) : (
                <XCircle size={24} color="#B71C1C" />
              )}
              <div>
                <div style={{
                  fontSize: '16px',
                  fontWeight: 700,
                  color: verificationResult.overall_status === 'PASSED' ? '#1E6B24' : '#B71C1C',
                  letterSpacing: '0.4px'
                }}>
                  {verificationResult.summary}
                </div>
                <div style={{ fontSize: '12px', color: '#4C5564', marginTop: '2px' }}>
                  Certificate: <span className="mono" style={{ fontWeight: 600 }}>{verificationResult.certificate_id}</span>
                  {verificationResult.issuer && ` | Issuer: ${verificationResult.issuer}`}
                </div>
              </div>
            </div>

            <StatusBadge
              status={verificationResult.overall_status}
              label={verificationResult.overall_status === 'PASSED' ? 'VERIFIED' : 'FAILED'}
            />
          </div>

          {/* Breakdown of 5 Individual Checks */}
          <div style={{ padding: '0 4px' }}>
            {/* Check 1: Structure */}
            {verificationResult.checks.structure && (
              <div className="check-item">
                <div>
                  <div className="check-info-title">1. Certificate Structure & Schema</div>
                  <div className="check-info-desc">{verificationResult.checks.structure.message}</div>
                </div>
                <StatusBadge
                  status={verificationResult.checks.structure.status}
                  label={verificationResult.checks.structure.label}
                />
              </div>
            )}

            {/* Check 2: Signature */}
            {verificationResult.checks.signature && (
              <div className="check-item">
                <div>
                  <div className="check-info-title">2. Digital Signature Verification</div>
                  <div className="check-info-desc">{verificationResult.checks.signature.message}</div>
                </div>
                <StatusBadge
                  status={verificationResult.checks.signature.status}
                  label={verificationResult.checks.signature.label}
                />
              </div>
            )}

            {/* Check 3: Issuer Trust */}
            {verificationResult.checks.issuer_trust && (
              <div className="check-item">
                <div>
                  <div className="check-info-title">3. Issuer Trust & Policy Federation</div>
                  <div className="check-info-desc">{verificationResult.checks.issuer_trust.message}</div>
                </div>
                <StatusBadge
                  status={verificationResult.checks.issuer_trust.status}
                  label={verificationResult.checks.issuer_trust.label}
                />
              </div>
            )}

            {/* Check 4: Validity Period */}
            {verificationResult.checks.expiry && (
              <div className="check-item">
                <div>
                  <div className="check-info-title">4. Certificate Validity Period</div>
                  <div className="check-info-desc">{verificationResult.checks.expiry.message}</div>
                </div>
                <StatusBadge
                  status={verificationResult.checks.expiry.status}
                  label={verificationResult.checks.expiry.label}
                />
              </div>
            )}

            {/* Check 5: Revocation */}
            {verificationResult.checks.revocation && (
              <div className="check-item">
                <div>
                  <div className="check-info-title">5. Authoritative Revocation Status</div>
                  <div className="check-info-desc">{verificationResult.checks.revocation.message}</div>
                </div>
                <StatusBadge
                  status={verificationResult.checks.revocation.status}
                  label={verificationResult.checks.revocation.label}
                />
              </div>
            )}
          </div>

          {/* Technical Diagnostics Disclosure */}
          <div style={{
            padding: '12px 18px',
            borderTop: '1px solid #E7EAEE',
            backgroundColor: '#FAFAFC',
            fontSize: '12px'
          }}>
            <button
              type="button"
              onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: '#394B64',
                fontWeight: 600
              }}
            >
              {showTechnicalDetails ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <span>{showTechnicalDetails ? 'Hide Technical Diagnostics' : 'Show Technical Diagnostics'}</span>
            </button>

            {showTechnicalDetails && (
              <div style={{ marginTop: '10px' }}>
                <pre className="mono" style={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #D9DDE3',
                  padding: '10px',
                  borderRadius: '3px',
                  fontSize: '11px',
                  overflowX: 'auto',
                  maxHeight: '220px'
                }}>
                  {JSON.stringify(verificationResult, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

