import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Award, 
  ShieldCheck, 
  FileX2, 
  RefreshCw,
  Clock,
  ArrowRight
} from 'lucide-react';
import { api } from '../services/api';
import StatusBadge from '../components/StatusBadge';

export default function DashboardPage({ setActivePage, user }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDashboard = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getDashboardSummary();
      setSummary(data);
    } catch (err) {
      setError(err.message || 'Failed to fetch dashboard metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>Administration Dashboard</h1>
          <p>Federated Public Key Infrastructure operational overview</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={loadDashboard}
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

      {/* Summary Cards */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Building2 size={13} color="#707783" />
            <span>Registered Organizations</span>
          </div>
          <div className="metric-value">
            {summary ? summary.metrics.registered_organizations : '—'}
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Award size={13} color="#707783" />
            <span>Active Certificates</span>
          </div>
          <div className="metric-value">
            {summary ? summary.metrics.active_certificates : '—'}
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ShieldCheck size={13} color="#707783" />
            <span>Verification Attempts</span>
          </div>
          <div className="metric-value">
            {summary ? summary.metrics.verification_attempts : '—'}
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FileX2 size={13} color="#707783" />
            <span>Revoked Certificates</span>
          </div>
          <div className="metric-value">
            {summary ? summary.metrics.revoked_certificates : '—'}
          </div>
        </div>
      </div>

      {/* Quick Access Bar */}
      <div style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid #D9DDE3',
        borderRadius: '4px',
        padding: '12px 18px',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ fontSize: '13px', color: '#252B35' }}>
          <strong>Logged in as:</strong> {user?.org_name} ({user?.org_identifier}) — Role: {user?.role}
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setActivePage('certificates')}
            className="btn btn-secondary btn-sm"
            type="button"
          >
            <Award size={13} />
            <span>Manage Certificates</span>
          </button>
          <button
            onClick={() => setActivePage('verify')}
            className="btn btn-primary btn-sm"
            type="button"
          >
            <ShieldCheck size={13} />
            <span>Verify Cross-Org Certificate</span>
          </button>
        </div>
      </div>

      {/* Recent Activity Table */}
      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">
            <Clock size={15} color="#394B64" />
            <span>Recent Security & Federation Activity</span>
          </div>
          <button
            onClick={() => setActivePage('audit')}
            className="btn btn-secondary btn-sm"
            style={{ fontSize: '11.5px', padding: '3px 8px' }}
          >
            <span>View Full Audit Log</span>
            <ArrowRight size={12} />
          </button>
        </div>

        <div className="table-responsive">
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: '180px' }}>Timestamp (UTC)</th>
                <th style={{ width: '120px' }}>Organization</th>
                <th style={{ width: '190px' }}>Event Type</th>
                <th style={{ width: '180px' }}>Certificate ID</th>
                <th style={{ width: '100px' }}>Result</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {loading && !summary ? (
                <tr>
                  <td colSpan="6" className="empty-state">Loading real activity records...</td>
                </tr>
              ) : summary?.recent_activities?.length > 0 ? (
                summary.recent_activities.map((act) => (
                  <tr key={act.id}>
                    <td className="mono" style={{ color: '#707783' }}>
                      {act.timestamp ? new Date(act.timestamp).toISOString().replace('T', ' ').slice(0, 19) : '—'}
                    </td>
                    <td>
                      <span className="badge badge-neutral mono">{act.org_identifier}</span>
                    </td>
                    <td style={{ fontWeight: 500 }}>{act.event_type}</td>
                    <td className="mono" style={{ color: '#394B64' }}>
                      {act.certificate_id || '—'}
                    </td>
                    <td>
                      <StatusBadge status={act.result} />
                    </td>
                    <td style={{ color: '#4C5564', fontSize: '12px' }}>
                      {act.details || '—'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="empty-state">No recent activity.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

