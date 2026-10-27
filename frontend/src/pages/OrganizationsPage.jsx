import React, { useState, useEffect } from 'react';
import { Building2, Key, RefreshCw, Plus, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';
import StatusBadge from '../components/StatusBadge';

export default function OrganizationsPage({ onNavigateRegister }) {
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const orgs = await api.getFederatedOrganizations();
      setOrganizations(orgs);
    } catch (err) {
      setError(err.message || 'Failed to fetch registered organizations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>Federated Organizations</h1>
          <p>Decentralized identity trust registry directory</p>
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
          <button
            onClick={onNavigateRegister}
            className="btn btn-primary btn-sm"
            type="button"
          >
            <Plus size={13} />
            <span>Register New Entity</span>
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

      {/* Trust Registry Directory */}
      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">
            <Building2 size={15} color="#394B64" />
            <span>Public Identity & Key Registry Directory</span>
          </div>
          <span style={{ fontSize: '12px', color: '#707783' }}>
            Total Registered Nodes: <strong>{organizations.length}</strong>
          </span>
        </div>

        <div className="table-responsive">
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: '130px' }}>Identifier</th>
                <th>Organization Name</th>
                <th style={{ width: '160px' }}>Organization Type</th>
                <th>Public Key SHA-256 Fingerprint</th>
                <th style={{ width: '130px' }}>Registry Status</th>
                <th style={{ width: '160px' }}>Registered At (UTC)</th>
              </tr>
            </thead>
            <tbody>
              {loading && organizations.length === 0 ? (
                <tr>
                  <td colSpan="6" className="empty-state">Loading federated organization records...</td>
                </tr>
              ) : organizations.length > 0 ? (
                organizations.map((org) => (
                  <tr key={org.org_identifier}>
                    <td>
                      <span className="badge badge-neutral mono" style={{ fontWeight: 600 }}>
                        {org.org_identifier}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600, color: '#252B35' }}>
                      {org.org_name}
                    </td>
                    <td style={{ color: '#4C5564' }}>
                      {org.org_type || 'Enterprise'}
                    </td>
                    <td>
                      <div className="mono" style={{ fontSize: '11px', color: '#394B64' }}>
                        {org.key_fingerprint || '—'}
                      </div>
                    </td>
                    <td>
                      <StatusBadge status={org.trust_status || 'TRUSTED'} />
                    </td>
                    <td className="mono" style={{ fontSize: '11.5px', color: '#707783' }}>
                      {org.registered_at ? org.registered_at.slice(0, 19).replace('T', ' ') : '—'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="empty-state">No organizations registered yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

