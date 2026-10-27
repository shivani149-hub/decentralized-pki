import React, { useState, useEffect } from 'react';
import { 
  FileX2, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw, 
  Search,
  X
} from 'lucide-react';
import { api } from '../services/api';
import StatusBadge from '../components/StatusBadge';
import ConfirmationModal from '../components/ConfirmationModal';

export default function RevocationPage({ user }) {
  const [revocations, setRevocations] = useState([]);
  const [myCertificates, setMyCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Revoke Action Form
  const [targetCertId, setTargetCertId] = useState('');
  const [reason, setReason] = useState('Key Compromise');
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [revoking, setRevoking] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [revs, certs] = await Promise.all([
        api.getRevocations(),
        api.getCertificates()
      ]);
      setRevocations(revs);
      // Filter certificates issued by current org that are still ACTIVE
      setMyCertificates(certs.filter(c => c.status === 'ACTIVE'));
    } catch (err) {
      setError(err.message || 'Failed to load revocation records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleInitiateRevoke = (e) => {
    e.preventDefault();
    if (!targetCertId.trim()) {
      setError('Please select or specify a Certificate ID to revoke.');
      return;
    }
    setError('');
    setIsConfirmOpen(true);
  };

  const handleConfirmRevoke = async () => {
    setRevoking(true);
    setError('');
    try {
      const resp = await api.revokeCertificate(targetCertId.trim(), reason);
      setSuccessMsg(resp.message);
      setIsConfirmOpen(false);
      setTargetCertId('');
      loadData();
    } catch (err) {
      setError(err.message || 'Revocation failed.');
      setIsConfirmOpen(false);
    } finally {
      setRevoking(false);
    }
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>Certificate Revocation Management</h1>
          <p>Authoritative revocation directory and certificate retirement service</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={loadData}
            className="btn btn-secondary btn-sm"
            type="button"
            disabled={loading}
          >
            <RefreshCw size={13} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
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

      {successMsg && (
        <div style={{
          backgroundColor: '#EAF7EC',
          border: '1px solid #C3E7C6',
          color: '#1E6B24',
          padding: '10px 14px',
          borderRadius: '4px',
          fontSize: '12.5px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={15} />
            <span>{successMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMsg('')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1E6B24' }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Revocation Submission Panel */}
      <div className="panel" style={{ marginBottom: '22px' }}>
        <div className="panel-header">
          <div className="panel-title">
            <FileX2 size={14} color="#C62828" />
            <span>Revoke an Issued Certificate</span>
          </div>
          <span style={{ fontSize: '11px', color: '#707783' }}>
            Authorized issuer: <strong>{user?.org_identifier}</strong>
          </span>
        </div>

        <form onSubmit={handleInitiateRevoke} className="panel-body">
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr auto',
            gap: '12px',
            alignItems: 'flex-end'
          }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#4C5564', marginBottom: '5px' }}>
                Certificate ID to Revoke
              </label>
              {myCertificates.length > 0 ? (
                <select
                  value={targetCertId}
                  onChange={(e) => setTargetCertId(e.target.value)}
                >
                  <option value="">-- Select Certificate or Enter Below --</option>
                  {myCertificates.map(c => (
                    <option key={c.cert_id} value={c.cert_id}>
                      {c.cert_id} — {c.subject_common_name} (Issuer: {c.issuer_org_identifier})
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  placeholder="e.g. CERT-ORG-B-12345678"
                  value={targetCertId}
                  onChange={(e) => setTargetCertId(e.target.value)}
                />
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#4C5564', marginBottom: '5px' }}>
                Revocation Reason
              </label>
              <select value={reason} onChange={(e) => setReason(e.target.value)}>
                <option value="Key Compromise">Key Compromise (RFC 5280 Reason 1)</option>
                <option value="CA Compromise">CA Compromise</option>
                <option value="Affiliation Changed">Affiliation Changed</option>
                <option value="Superseded">Superseded / Re-issued</option>
                <option value="Cessation of Operation">Cessation of Operation</option>
                <option value="Privilege Withdrawn">Privilege Withdrawn</option>
              </select>
            </div>

            <div>
              <button
                type="submit"
                className="btn btn-danger btn-sm"
                style={{ padding: '7px 16px', height: '33px' }}
                disabled={revoking}
              >
                <span>Revoke Certificate</span>
              </button>
            </div>
          </div>

          <div style={{ marginTop: '10px', fontSize: '11.5px', color: '#707783' }}>
            <strong>Security Restriction:</strong> Cross-organizational authorization is strictly enforced. You can only revoke certificates issued by your organization (<strong>{user?.org_identifier}</strong>). Revocation attempts against other organizations' certificates will be rejected with an authorization error.
          </div>
        </form>
      </div>

      {/* Revocation List Table */}
      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">
            <span>Authoritative Revocation Directory</span>
          </div>
          <span style={{ fontSize: '12px', color: '#707783' }}>
            Total Revoked: <strong>{revocations.length}</strong>
          </span>
        </div>

        <div className="table-responsive">
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: '180px' }}>Certificate ID</th>
                <th>Subject Identity</th>
                <th style={{ width: '130px' }}>Issuer Org</th>
                <th style={{ width: '100px' }}>Status</th>
                <th style={{ width: '180px' }}>Revocation Reason</th>
                <th style={{ width: '170px' }}>Revocation Timestamp (UTC)</th>
                <th style={{ width: '120px' }}>Revoked By</th>
              </tr>
            </thead>
            <tbody>
              {loading && revocations.length === 0 ? (
                <tr>
                  <td colSpan="7" className="empty-state">Loading authoritative revocation list...</td>
                </tr>
              ) : revocations.length > 0 ? (
                revocations.map((r) => (
                  <tr key={r.id}>
                    <td className="mono" style={{ fontWeight: 600, color: '#C62828' }}>
                      {r.cert_id}
                    </td>
                    <td>{r.subject}</td>
                    <td>
                      <span className="badge badge-neutral mono">{r.issuer}</span>
                    </td>
                    <td>
                      <StatusBadge status="REVOKED" />
                    </td>
                    <td style={{ color: '#252B35', fontWeight: 500 }}>
                      {r.reason}
                    </td>
                    <td className="mono" style={{ fontSize: '11.5px', color: '#707783' }}>
                      {r.revoked_at ? r.revoked_at.slice(0, 19).replace('T', ' ') : '—'}
                    </td>
                    <td>
                      <span className="badge badge-neutral mono">{r.revoked_by_org}</span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="empty-state">
                    No certificates have been revoked yet in this federation.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmationModal
        isOpen={isConfirmOpen}
        title="Confirm Certificate Revocation"
        message={`Are you sure you want to permanently revoke certificate '${targetCertId}' for reason '${reason}'? This authoritative revocation statement will be immediately recorded in the federated trust registry and subsequent verification checks will fail.`}
        confirmText="Confirm Permanent Revocation"
        confirmType="danger"
        isLoading={revoking}
        onConfirm={handleConfirmRevoke}
        onCancel={() => setIsConfirmOpen(false)}
      />
    </div>
  );
}

