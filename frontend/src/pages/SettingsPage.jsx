import React, { useState, useEffect } from 'react';
import { Sliders, Shield, RefreshCw, CheckCircle2, XCircle, Info, Lock } from 'lucide-react';
import { api } from '../services/api';
import StatusBadge from '../components/StatusBadge';

export default function SettingsPage({ user }) {
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [updatingPeer, setUpdatingPeer] = useState(null);

  const loadPolicies = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getTrustPolicies();
      setPolicies(data);
    } catch (err) {
      setError(err.message || 'Failed to fetch federated trust policies.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPolicies();
  }, []);

  const handleToggleTrust = async (peer) => {
    const newTrustStatus = !peer.is_trusted;
    setUpdatingPeer(peer.peer_org_identifier);
    setError('');
    setSuccessMsg('');

    try {
      const resp = await api.updateTrustPolicy(
        peer.peer_org_identifier,
        newTrustStatus,
        `Policy manually updated from console to ${newTrustStatus ? 'TRUSTED' : 'UNTRUSTED'}`
      );
      setSuccessMsg(resp.message);
      loadPolicies();
    } catch (err) {
      setError(err.message || 'Failed to update trust policy.');
    } finally {
      setUpdatingPeer(null);
    }
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>Federation Trust Policy Settings</h1>
          <p>Decentralized bilateral and multilateral trust policy configuration</p>
        </div>
        <button
          onClick={loadPolicies}
          className="btn btn-secondary btn-sm"
          type="button"
          disabled={loading}
        >
          <RefreshCw size={13} className={loading ? 'spin' : ''} />
          <span>Refresh</span>
        </button>
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
          marginBottom: '16px'
        }}>
          {successMsg}
        </div>
      )}

      {/* Local Node Information Panel */}
      <div className="panel" style={{ marginBottom: '20px' }}>
        <div className="panel-header">
          <div className="panel-title">
            <Lock size={14} color="#394B64" />
            <span>Local Organization Configuration</span>
          </div>
        </div>
        <div className="panel-body" style={{ fontSize: '12.5px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
            <div>
              <div style={{ color: '#707783', fontSize: '11px', textTransform: 'uppercase', marginBottom: '2px' }}>
                Local Identifier
              </div>
              <div className="mono" style={{ fontWeight: 600, fontSize: '13px' }}>
                {user?.org_identifier}
              </div>
            </div>

            <div>
              <div style={{ color: '#707783', fontSize: '11px', textTransform: 'uppercase', marginBottom: '2px' }}>
                Organization Name
              </div>
              <div style={{ fontWeight: 600, fontSize: '13px' }}>
                {user?.org_name}
              </div>
            </div>

            <div>
              <div style={{ color: '#707783', fontSize: '11px', textTransform: 'uppercase', marginBottom: '2px' }}>
                Cryptographic Key Handling
              </div>
              <div style={{ color: '#1E6B24', fontWeight: 600, fontSize: '12px' }}>
                RSA-2048 / SHA-256 (Local Keystore)
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Trust Policy Matrix */}
      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">
            <Shield size={14} color="#394B64" />
            <span>Peer Organization Trust Policies</span>
          </div>
        </div>

        <div style={{
          padding: '12px 18px',
          backgroundColor: '#FAFAFC',
          borderBottom: '1px solid #E7EAEE',
          fontSize: '12px',
          color: '#4C5564',
          display: 'flex',
          gap: '8px',
          alignItems: 'center'
        }}>
          <Info size={15} color="#394B64" />
          <span>
            In a decentralized PKI, authentication alone does not imply automatic certificate trust. Each organization maintains its own trust policy. Toggling a peer to 'Untrusted' causes Verification Check #3 (Issuer Trust) to fail immediately!
          </span>
        </div>

        <div className="table-responsive">
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: '130px' }}>Peer Org ID</th>
                <th>Peer Organization Name</th>
                <th>Public Key Fingerprint</th>
                <th style={{ width: '130px' }}>Trust Status</th>
                <th style={{ width: '180px', textAlign: 'right' }}>Policy Control</th>
              </tr>
            </thead>
            <tbody>
              {loading && policies.length === 0 ? (
                <tr>
                  <td colSpan="5" className="empty-state">Loading trust policies...</td>
                </tr>
              ) : policies.length > 0 ? (
                policies.map((p) => (
                  <tr key={p.peer_org_identifier}>
                    <td>
                      <span className="badge badge-neutral mono" style={{ fontWeight: 600 }}>
                        {p.peer_org_identifier}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      {p.peer_org_name}
                    </td>
                    <td>
                      <div className="mono" style={{ fontSize: '11px', color: '#707783' }}>
                        {p.key_fingerprint}
                      </div>
                    </td>
                    <td>
                      <StatusBadge
                        status={p.is_trusted ? 'TRUSTED' : 'UNTRUSTED'}
                        label={p.is_trusted ? 'Trusted' : 'Untrusted'}
                      />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={() => handleToggleTrust(p)}
                        className={`btn btn-sm ${p.is_trusted ? 'btn-danger' : 'btn-primary'}`}
                        style={{ fontSize: '11.5px', padding: '3px 10px' }}
                        disabled={updatingPeer === p.peer_org_identifier}
                      >
                        {updatingPeer === p.peer_org_identifier
                          ? 'Updating...'
                          : p.is_trusted
                          ? 'Mark as Untrusted'
                          : 'Mark as Trusted'}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="empty-state">
                    No other federated peer organizations found in registry.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

