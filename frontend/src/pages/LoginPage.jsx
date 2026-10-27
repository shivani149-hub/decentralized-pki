import React, { useState, useEffect } from 'react';
import { Shield, Lock, Mail, Building } from 'lucide-react';
import { api, setSession } from '../services/api';

export default function LoginPage({ onLoginSuccess, onNavigateRegister }) {
  const [organizations, setOrganizations] = useState([]);
  const [selectedOrg, setSelectedOrg] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadOrganizations() {
      try {
        const orgs = await api.getDemoOrganizations();
        setOrganizations(orgs);
        if (orgs.length > 0) {
          setSelectedOrg(orgs[0].identifier);
          setEmail(`admin@${orgs[0].identifier.toLowerCase()}.internal`);
          setPassword('Password123!');
        }
      } catch (err) {
        // Fallback default organizations
        const defaults = [
          { identifier: 'ORG-A', name: 'Organization A' },
          { identifier: 'ORG-B', name: 'Organization B' }
        ];
        setOrganizations(defaults);
        setSelectedOrg('ORG-A');
        setEmail('admin@org-a.internal');
        setPassword('Password123!');
      }
    }
    loadOrganizations();
  }, []);

  const handleOrgChange = (newOrgId) => {
    setSelectedOrg(newOrgId);
    setEmail(`admin@${newOrgId.toLowerCase()}.internal`);
    setPassword('Password123!');
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!selectedOrg) {
      setError('Please select an organization.');
      return;
    }
    if (!email || !password) {
      setError('Email and password are required.');
      return;
    }

    setLoading(true);
    try {
      const resp = await api.login(selectedOrg, email, password);
      setSession(resp.token, resp.user);
      onLoginSuccess(resp.user);
    } catch (err) {
      setError(err.message || 'Authentication failed. Verify organization credentials.');
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
      padding: '20px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '380px',
        backgroundColor: '#FFFFFF',
        border: '1px solid #D9DDE3',
        borderRadius: '4px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: '1px solid #E7EAEE',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            backgroundColor: '#394B64',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF'
          }}>
            <Shield size={18} strokeWidth={2.2} />
          </div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: '#252B35' }}>
              Decentralized PKI
            </div>
            <div style={{ fontSize: '11.5px', color: '#707783' }}>
              Federated Identity Administration
            </div>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '20px 24px' }}>
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

          {/* Organization Selector */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: 600,
              color: '#4C5564',
              marginBottom: '5px'
            }}>
              Organization
            </label>
            <div style={{ position: 'relative' }}>
              <select
                value={selectedOrg}
                onChange={(e) => handleOrgChange(e.target.value)}
                disabled={loading}
              >
                {organizations.map((org) => (
                  <option key={org.identifier} value={org.identifier}>
                    {org.name} ({org.identifier})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Organization Switchers */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
            <button
              type="button"
              onClick={() => handleOrgChange('ORG-A')}
              className={`btn btn-sm ${selectedOrg === 'ORG-A' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ flex: 1, fontSize: '11.5px' }}
            >
              Organization A
            </button>
            <button
              type="button"
              onClick={() => handleOrgChange('ORG-B')}
              className={`btn btn-sm ${selectedOrg === 'ORG-B' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ flex: 1, fontSize: '11.5px' }}
            >
              Organization B
            </button>
          </div>

          {/* Email */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: 600,
              color: '#4C5564',
              marginBottom: '5px'
            }}>
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@org.internal"
              required
              disabled={loading}
            />
          </div>

          {/* Password */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: 600,
              color: '#4C5564',
              marginBottom: '5px'
            }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              disabled={loading}
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '8px 14px' }}
            disabled={loading}
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        {/* Footer Link */}
        <div style={{
          padding: '12px 24px',
          borderTop: '1px solid #E7EAEE',
          backgroundColor: '#FAFAFC',
          fontSize: '12px',
          textAlign: 'center',
          color: '#707783'
        }}>
          Need to onboard a new entity?{' '}
          <button
            type="button"
            onClick={onNavigateRegister}
            style={{
              background: 'none',
              border: 'none',
              color: '#394B64',
              fontWeight: 600,
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
          >
            Register Organization
          </button>
        </div>
      </div>
    </div>
  );
}

