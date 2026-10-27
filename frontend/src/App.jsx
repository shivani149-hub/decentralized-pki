import React, { useState, useEffect } from 'react';
import { getStoredUser, getToken, clearSession } from './services/api';
import Sidebar from './components/Sidebar';
import TopNavbar from './components/TopNavbar';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import OrganizationsPage from './pages/OrganizationsPage';
import CertificatesPage from './pages/CertificatesPage';
import VerifyCertPage from './pages/VerifyCertPage';
import RevocationPage from './pages/RevocationPage';
import AuditLogsPage from './pages/AuditLogsPage';
import SettingsPage from './pages/SettingsPage';

const PAGE_TITLES = {
  dashboard: 'Administration Dashboard',
  organizations: 'Federated Organizations Registry',
  certificates: 'Certificate & Keystore Management',
  verify: 'Cross-Organizational Certificate Verification',
  revocation: 'Authoritative Revocation Management',
  audit: 'Security Audit Trail',
  settings: 'Federation Trust Policy Settings'
};

export default function App() {
  const [user, setUser] = useState(null);
  const [authView, setAuthView] = useState('login'); // 'login' | 'register'
  const [activePage, setActivePage] = useState('dashboard');
  const [selectedCertForVerification, setSelectedCertForVerification] = useState(null);

  useEffect(() => {
    const token = getToken();
    const stored = getStoredUser();
    if (token && stored) {
      setUser(stored);
    }
  }, []);

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    setActivePage('dashboard');
  };

  const handleLogout = () => {
    clearSession();
    setUser(null);
    setAuthView('login');
    setActivePage('dashboard');
    setSelectedCertForVerification(null);
  };

  // If not logged in
  if (!user) {
    if (authView === 'register') {
      return <RegisterPage onNavigateLogin={() => setAuthView('login')} />;
    }
    return (
      <LoginPage
        onLoginSuccess={handleLoginSuccess}
        onNavigateRegister={() => setAuthView('register')}
      />
    );
  }

  // Logged-in Enterprise Administration Shell
  return (
    <div className="app-container">
      <Sidebar
        activePage={activePage}
        setActivePage={(page) => {
          setActivePage(page);
          if (page !== 'verify') {
            setSelectedCertForVerification(null);
          }
        }}
        onLogout={handleLogout}
        user={user}
      />

      <div className="main-content-wrapper">
        <TopNavbar
          title={PAGE_TITLES[activePage] || 'Administration Console'}
          user={user}
        />

        <main style={{ flex: 1 }}>
          {activePage === 'dashboard' && (
            <DashboardPage
              setActivePage={setActivePage}
              user={user}
            />
          )}

          {activePage === 'organizations' && (
            <OrganizationsPage
              onNavigateRegister={() => setActivePage('organizations')}
            />
          )}

          {activePage === 'certificates' && (
            <CertificatesPage
              setActivePage={setActivePage}
              setSelectedCertForVerification={setSelectedCertForVerification}
              user={user}
            />
          )}

          {activePage === 'verify' && (
            <VerifyCertPage
              key={typeof selectedCertForVerification === 'string' ? selectedCertForVerification : 'verify-key'}
              initialCertificate={selectedCertForVerification}
              user={user}
            />
          )}

          {activePage === 'revocation' && (
            <RevocationPage
              user={user}
            />
          )}

          {activePage === 'audit' && (
            <AuditLogsPage
              user={user}
            />
          )}

          {activePage === 'settings' && (
            <SettingsPage
              user={user}
            />
          )}
        </main>
      </div>
    </div>
  );
}

