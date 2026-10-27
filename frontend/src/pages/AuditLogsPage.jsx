import React, { useState, useEffect } from 'react';
import { 
  ScrollText, 
  Search, 
  RefreshCw, 
  Info,
  Filter
} from 'lucide-react';
import { api } from '../services/api';
import StatusBadge from '../components/StatusBadge';

export default function AuditLogsPage({ user }) {
  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState('');
  const [eventType, setEventType] = useState('ALL');
  const [resultFilter, setResultFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadLogs = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getAuditLogs(search, eventType, resultFilter);
      setLogs(data);
    } catch (err) {
      setError(err.message || 'Failed to fetch audit records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [eventType, resultFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadLogs();
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>Security Audit Trail</h1>
          <p>Immutable log of cryptographic actions, verifications, and trust events</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={loadLogs}
            className="btn btn-secondary btn-sm"
            type="button"
            disabled={loading}
          >
            <RefreshCw size={13} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Audit Policy Banner */}
      <div style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid #D9DDE3',
        borderRadius: '4px',
        padding: '10px 14px',
        marginBottom: '16px',
        fontSize: '12px',
        color: '#4C5564',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <Info size={16} color="#394B64" />
        <div>
          <strong>Audit Integrity:</strong> Logs are strictly append-only. Users cannot edit or delete audit records. No private keys, passwords, or session secrets are recorded.
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
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '8px', flex: 1, maxWidth: '380px' }}>
          <div style={{ position: 'relative', width: '100%' }}>
            <input
              type="text"
              placeholder="Search by Org, Event Type, or Cert ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: '28px' }}
            />
            <Search size={14} color="#707783" style={{ position: 'absolute', left: '9px', top: '9px' }} />
          </div>
          <button type="submit" className="btn btn-secondary btn-sm">Filter</button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', color: '#707783' }}>Event:</span>
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              style={{ width: '170px', padding: '5px 8px', fontSize: '12px' }}
            >
              <option value="ALL">All Event Types</option>
              <option value="CERT_ISSUED">CERT_ISSUED</option>
              <option value="CERT_VERIFIED">CERT_VERIFIED</option>
              <option value="CERT_REVOKED">CERT_REVOKED</option>
              <option value="KEYPAIR_GENERATED">KEYPAIR_GENERATED</option>
              <option value="ORG_REGISTERED">ORG_REGISTERED</option>
              <option value="TRUST_POLICY_UPDATED">TRUST_POLICY_UPDATED</option>
              <option value="AUTH_LOGIN_SUCCESS">AUTH_LOGIN_SUCCESS</option>
              <option value="UNAUTHORIZED_REVOKE_ATTEMPT">UNAUTHORIZED_REVOKE</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', color: '#707783' }}>Result:</span>
            <select
              value={resultFilter}
              onChange={(e) => setResultFilter(e.target.value)}
              style={{ width: '110px', padding: '5px 8px', fontSize: '12px' }}
            >
              <option value="ALL">All Results</option>
              <option value="SUCCESS">SUCCESS</option>
              <option value="FAILED">FAILED</option>
              <option value="DENIED">DENIED</option>
            </select>
          </div>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="panel">
        <div className="table-responsive">
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: '170px' }}>Timestamp (UTC)</th>
                <th style={{ width: '120px' }}>Organization</th>
                <th style={{ width: '160px' }}>User Account</th>
                <th style={{ width: '190px' }}>Event Type</th>
                <th style={{ width: '170px' }}>Certificate ID</th>
                <th style={{ width: '100px' }}>Result</th>
                <th>Event Details</th>
              </tr>
            </thead>
            <tbody>
              {loading && logs.length === 0 ? (
                <tr>
                  <td colSpan="7" className="empty-state">Loading audit event log...</td>
                </tr>
              ) : logs.length > 0 ? (
                logs.map((log) => (
                  <tr key={log.id}>
                    <td className="mono" style={{ fontSize: '11.5px', color: '#707783' }}>
                      {log.timestamp ? log.timestamp.slice(0, 19).replace('T', ' ') : '—'}
                    </td>
                    <td>
                      <span className="badge badge-neutral mono">{log.org_identifier}</span>
                    </td>
                    <td style={{ fontSize: '12px', color: '#4C5564' }}>
                      {log.user_email || 'System'}
                    </td>
                    <td style={{ fontWeight: 600, fontSize: '12px' }}>
                      {log.event_type}
                    </td>
                    <td className="mono" style={{ fontSize: '11.5px', color: '#394B64' }}>
                      {log.certificate_id || '—'}
                    </td>
                    <td>
                      <StatusBadge status={log.result} />
                    </td>
                    <td style={{ fontSize: '12px', color: '#252B35' }}>
                      {log.details || '—'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="empty-state">No audit logs matching query criteria.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

