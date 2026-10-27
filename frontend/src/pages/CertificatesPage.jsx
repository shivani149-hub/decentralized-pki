import React, { useState, useEffect } from 'react';
import { 
  Award, 
  Key, 
  Plus, 
  Search, 
  Download, 
  Eye, 
  CheckCircle2, 
  RefreshCw,
  ExternalLink,
  ShieldAlert,
  X
} from 'lucide-react';
import { api } from '../services/api';
import StatusBadge from '../components/StatusBadge';
import ConfirmationModal from '../components/ConfirmationModal';

export default function CertificatesPage({ setActivePage, setSelectedCertForVerification, user }) {
  const [certificates, setCertificates] = useState([]);
  const [keystore, setKeystore] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modals state
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [isKeygenModalOpen, setIsKeygenModalOpen] = useState(false);
  const [inspectCert, setInspectCert] = useState(null);

  // Issue Form state
  const [issueForm, setIssueForm] = useState({
    subject_common_name: '',
    subject_type: 'ServiceIdentity',
    validity_days: 365
  });
  const [issuing, setIssuing] = useState(false);
  const [keyGenerating, setKeyGenerating] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [certs, ks] = await Promise.all([
        api.getCertificates(search, statusFilter),
        api.getKeystoreStatus()
      ]);
      setCertificates(certs);
      setKeystore(ks);
    } catch (err) {
      setError(err.message || 'Failed to load certificate records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadData();
  };

  const handleGenerateKey = async () => {
    setKeyGenerating(true);
    setError('');
    try {
      const res = await api.generateKeypair();
      setSuccessMsg(res.message);
      setIsKeygenModalOpen(false);
      loadData();
    } catch (err) {
      setError(err.message || 'Failed to generate keypair.');
    } finally {
      setKeyGenerating(false);
    }
  };

  const handleIssueSubmit = async (e) => {
    e.preventDefault();
    if (!issueForm.subject_common_name.trim()) return;

    setIssuing(true);
    setError('');
    try {
      const res = await api.issueCertificate({
        ...issueForm,
        subject_org_identifier: user?.org_identifier
      });
      setSuccessMsg(res.message);
      setIsIssueModalOpen(false);
      setIssueForm({ subject_common_name: '', subject_type: 'ServiceIdentity', validity_days: 365 });
      loadData();
    } catch (err) {
      setError(err.message || 'Certificate issuance failed.');
    } finally {
      setIssuing(false);
    }
  };

  const handleInspect = async (certId) => {
    try {
      const details = await api.getCertificateDetails(certId);
      setInspectCert(details);
    } catch (err) {
      setError(err.message || 'Failed to fetch certificate envelope.');
    }
  };

  const handleDownload = (certId, jsonStr) => {
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${certId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleVerifyInInspector = (cert) => {
    let envelope = null;
    try {
      envelope = JSON.parse(cert.certificate_json || '{}');
    } catch {
      envelope = null;
    }
    if (setSelectedCertForVerification) {
      setSelectedCertForVerification(envelope || cert.cert_id);
      setActivePage('verify');
    }
  };

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1>Certificate Management</h1>
          <p>Cryptographic key management and verifiable certificate issuance</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setIsKeygenModalOpen(true)}
            className="btn btn-secondary btn-sm"
            type="button"
          >
            <Key size={13} />
            <span>Rotate Keypair</span>
          </button>
          <button
            onClick={() => setIsIssueModalOpen(true)}
            className="btn btn-primary btn-sm"
            type="button"
          >
            <Plus size={14} />
            <span>Issue Certificate</span>
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

      {/* Filter and Search Bar */}
      <div style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid #D9DDE3',
        borderRadius: '4px',
        padding: '10px 14px',
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '8px', flex: 1, maxWidth: '400px' }}>
          <div style={{ position: 'relative', width: '100%' }}>
            <input
              type="text"
              placeholder="Search by ID, Subject or Issuer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: '28px' }}
            />
            <Search size={14} color="#707783" style={{ position: 'absolute', left: '9px', top: '9px' }} />
          </div>
          <button type="submit" className="btn btn-secondary btn-sm">Filter</button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: '#707783' }}>Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: '130px', padding: '5px 8px', fontSize: '12px' }}
          >
            <option value="ALL">All Certificates</option>
            <option value="ACTIVE">Active</option>
            <option value="REVOKED">Revoked</option>
          </select>

          <button
            onClick={loadData}
            className="btn btn-secondary btn-sm"
            type="button"
            title="Reload list"
          >
            <RefreshCw size={13} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {/* Certificates Table */}
      <div className="panel">
        <div className="table-responsive">
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: '170px' }}>Certificate ID</th>
                <th>Subject</th>
                <th style={{ width: '130px' }}>Issuer</th>
                <th style={{ width: '150px' }}>Created Date</th>
                <th style={{ width: '150px' }}>Expiry Date</th>
                <th style={{ width: '100px' }}>Status</th>
                <th style={{ width: '190px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && certificates.length === 0 ? (
                <tr>
                  <td colSpan="7" className="empty-state">Loading certificate records...</td>
                </tr>
              ) : certificates.length > 0 ? (
                certificates.map((cert) => (
                  <tr key={cert.id}>
                    <td className="mono" style={{ fontWeight: 600, color: '#394B64' }}>
                      {cert.cert_id}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{cert.subject_common_name}</div>
                      <div style={{ fontSize: '11px', color: '#707783' }}>{cert.subject_type}</div>
                    </td>
                    <td>
                      <span className="badge badge-neutral mono">{cert.issuer_org_identifier}</span>
                    </td>
                    <td className="mono" style={{ fontSize: '11.5px', color: '#707783' }}>
                      {cert.created_at ? cert.created_at.slice(0, 10) : '—'}
                    </td>
                    <td className="mono" style={{ fontSize: '11.5px', color: '#707783' }}>
                      {cert.valid_to ? cert.valid_to.slice(0, 10) : '—'}
                    </td>
                    <td>
                      <StatusBadge status={cert.status} />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '5px' }}>
                        <button
                          onClick={() => handleInspect(cert.cert_id)}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '3px 7px' }}
                          title="View Certificate Envelope"
                          type="button"
                        >
                          <Eye size={12} />
                        </button>
                        <button
                          onClick={() => handleDownload(cert.cert_id, cert.certificate_json || '{}')}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '3px 7px' }}
                          title="Download Certificate JSON"
                          type="button"
                        >
                          <Download size={12} />
                        </button>
                        <button
                          onClick={() => handleVerifyInInspector(cert)}
                          className="btn btn-primary btn-sm"
                          style={{ padding: '3px 8px', fontSize: '11.5px' }}
                          type="button"
                        >
                          <span>Verify</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="empty-state">
                    No certificate records found matching the criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Issue Certificate Modal */}
      {isIssueModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div className="modal-header">
              <div className="modal-title">Issue Digitally Signed Certificate</div>
              <button
                type="button"
                onClick={() => setIsIssueModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#707783' }}
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleIssueSubmit}>
              <div className="modal-body">
                <div style={{
                  backgroundColor: '#FAFAFC',
                  border: '1px solid #E7EAEE',
                  padding: '10px 14px',
                  borderRadius: '4px',
                  marginBottom: '14px',
                  fontSize: '12px',
                  color: '#4C5564'
                }}>
                  <strong>Issuer Identity:</strong> {user?.org_name} ({user?.org_identifier}). The certificate will be cryptographically signed for this organization.
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#4C5564', marginBottom: '4px' }}>
                    Subject Common Name (Identity FQDN)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. auth-service.internal or node-1.cluster"
                    value={issueForm.subject_common_name}
                    onChange={(e) => setIssueForm({ ...issueForm, subject_common_name: e.target.value })}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#4C5564', marginBottom: '4px' }}>
                      Subject Type
                    </label>
                    <select
                      value={issueForm.subject_type}
                      onChange={(e) => setIssueForm({ ...issueForm, subject_type: e.target.value })}
                    >
                      <option value="ServiceIdentity">Service Identity</option>
                      <option value="MachineNode">Machine / Server Node</option>
                      <option value="WebEndpoint">API / Web Endpoint</option>
                      <option value="UserIdentity">Federated User Identity</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#4C5564', marginBottom: '4px' }}>
                      Validity Window (Days)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="1825"
                      value={issueForm.validity_days}
                      onChange={(e) => setIssueForm({ ...issueForm, validity_days: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setIsIssueModalOpen(false)}
                  className="btn btn-secondary btn-sm"
                  disabled={issuing}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={issuing}
                >
                  {issuing ? 'Signing Certificate...' : 'Sign & Issue Certificate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inspect Certificate Modal */}
      {inspectCert && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '640px' }}>
            <div className="modal-header">
              <div className="modal-title">Certificate Envelope: {inspectCert.cert_id}</div>
              <button
                type="button"
                onClick={() => setInspectCert(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#707783' }}
              >
                <X size={16} />
              </button>
            </div>
            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '12px', color: '#707783' }}>Authoritative Status: </span>
                  <StatusBadge status={inspectCert.status} />
                </div>
                <div>
                  <span style={{ fontSize: '12px', color: '#707783' }}>Algorithm: </span>
                  <span className="mono" style={{ fontWeight: 600 }}>{inspectCert.signature_algorithm}</span>
                </div>
              </div>

              <div style={{ marginBottom: '10px' }}>
                <div style={{ fontSize: '11.5px', fontWeight: 600, color: '#4C5564', marginBottom: '4px' }}>
                  Digital Signature (Base64 RSA-2048):
                </div>
                <div className="mono" style={{
                  backgroundColor: '#F8F9FA',
                  border: '1px solid #D9DDE3',
                  padding: '8px',
                  borderRadius: '3px',
                  fontSize: '11px',
                  wordBreak: 'break-all',
                  color: '#252B35'
                }}>
                  {inspectCert.signature_b64}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '11.5px', fontWeight: 600, color: '#4C5564', marginBottom: '4px' }}>
                  Canonical Certificate Structure:
                </div>
                <pre className="mono" style={{
                  backgroundColor: '#F8F9FA',
                  border: '1px solid #D9DDE3',
                  padding: '10px',
                  borderRadius: '3px',
                  fontSize: '11.5px',
                  overflowX: 'auto',
                  maxHeight: '250px'
                }}>
                  {JSON.stringify(inspectCert.full_envelope || JSON.parse(inspectCert.certificate_json || '{}'), null, 2)}
                </pre>
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                onClick={() => handleDownload(inspectCert.cert_id, inspectCert.certificate_json)}
                className="btn btn-secondary btn-sm"
              >
                <Download size={13} />
                <span>Export JSON</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const c = inspectCert;
                  setInspectCert(null);
                  handleVerifyInInspector(c);
                }}
                className="btn btn-primary btn-sm"
              >
                <span>Open in Verification Engine</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Keypair Generation Confirmation Modal */}
      <ConfirmationModal
        isOpen={isKeygenModalOpen}
        title="Generate / Rotate Cryptographic Keypair"
        message="Generating a new RSA-2048 keypair will update the cryptographic keys in your local keystore and publish the public key to the federated Trust Registry. Are you sure you wish to proceed?"
        confirmText="Generate New Keypair"
        confirmType="primary"
        isLoading={keyGenerating}
        onConfirm={handleGenerateKey}
        onCancel={() => setIsKeygenModalOpen(false)}
      />
    </div>
  );
}

