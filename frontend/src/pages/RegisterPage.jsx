import React, { useState } from 'react';
import { Shield, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';

export default function RegisterPage({ onNavigateLogin }) {
  const [formData, setFormData] = useState({
    name: '',
    identifier: '',
    org_type: 'Enterprise',
    contact_email: '',
    admin_email: '',
    admin_password: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const resp = await api.registerOrg(formData);
      setSuccess(resp);
    } catch (err) {
      setError(err.message || 'Failed to register organization.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#F7F8FA',
      padding: '24px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '460px',
        backgroundColor: '#FFFFFF',
        border: '1px solid #D9DDE3',
        borderRadius: '4px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid #E7EAEE',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Shield size={18} color="#394B64" />
            <span style={{ fontSize: '14.5px', fontWeight: 600, color: '#252B35' }}>
              Register Organization
            </span>
          </div>
          <button
            type="button"
            onClick={onNavigateLogin}
            className="btn btn-secondary btn-sm"
          >
            <ArrowLeft size={13} />
            <span>Back to Login</span>
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '20px 24px' }}>
          {success ? (
            <div>
              <div style={{
                backgroundColor: '#EAF7EC',
                border: '1px solid #C3E7C6',
                color: '#1E6B24',
                padding: '14px',
                borderRadius: '4px',
                marginBottom: '18px',
                fontSize: '12.5px'
              }}>
                <div style={{ fontWeight: 600, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle2 size={16} />
                  <span>Registration & Onboarding Complete</span>
                </div>
                <p>{success.message}</p>
                <div style={{ marginTop: '8px', fontSize: '11.5px', color: '#252B35' }}>
                  <strong>Registered Key Fingerprint:</strong>
                  <div className="mono" style={{ marginTop: '2px', wordBreak: 'break-all' }}>
                    {success.key_fingerprint}
                  </div>
                </div>
              </div>

              <div style={{
                backgroundColor: '#FAFAFC',
                border: '1px solid #E7EAEE',
                padding: '12px',
                borderRadius: '4px',
                fontSize: '12px',
                color: '#707783',
                marginBottom: '18px'
              }}>
                <strong>Trust Status Notice:</strong> Newly registered organizations are published to the Trust Registry with initial untrusted/pending status until bilateral or multilateral trust policies are accepted by federated peer organizations.
              </div>

              <button
                type="button"
                onClick={onNavigateLogin}
                className="btn btn-primary"
                style={{ width: '100%' }}
              >
                Proceed to Sign In
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {error && (
                <div style={{
                  backgroundColor: '#FDEDEE',
                  border: '1px solid #F8B4B8',
                  color: '#B71C1C',
                  padding: '8px 12px',
                  borderRadius: '4px',
                  fontSize: '12.5px',
                  marginBottom: '16px'
                }}>
                  {error}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#4C5564', marginBottom: '4px' }}>
                    Organization Name
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="e.g. Apex Health"
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#4C5564', marginBottom: '4px' }}>
                    Identifier (Uppercase)
                  </label>
                  <input
                    type="text"
                    name="identifier"
                    value={formData.identifier}
                    onChange={handleChange}
                    placeholder="e.g. ORG-C"
                    required
                    style={{ textTransform: 'uppercase' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#4C5564', marginBottom: '4px' }}>
                    Organization Type
                  </label>
                  <select name="org_type" value={formData.org_type} onChange={handleChange}>
                    <option value="Enterprise">Enterprise</option>
                    <option value="Financial Services">Financial Services</option>
                    <option value="Cloud Logistics">Cloud Logistics</option>
                    <option value="Healthcare">Healthcare</option>
                    <option value="Government">Government Agency</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#4C5564', marginBottom: '4px' }}>
                    Contact Email
                  </label>
                  <input
                    type="email"
                    name="contact_email"
                    value={formData.contact_email}
                    onChange={handleChange}
                    placeholder="contact@org-c.internal"
                    required
                  />
                </div>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#4C5564', marginBottom: '4px' }}>
                  Admin User Email
                </label>
                <input
                  type="email"
                  name="admin_email"
                  value={formData.admin_email}
                  onChange={handleChange}
                  placeholder="admin@org-c.internal"
                  required
                />
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#4C5564', marginBottom: '4px' }}>
                  Admin Password
                </label>
                <input
                  type="password"
                  name="admin_password"
                  value={formData.admin_password}
                  onChange={handleChange}
                  placeholder="Minimum 6 characters"
                  required
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', padding: '8px 14px' }}
                disabled={loading}
              >
                {loading ? 'Registering & Generating Keys...' : 'Register & Onboard'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

