import React from 'react';
import { 
  LayoutDashboard, 
  Building2, 
  Award, 
  ShieldCheck, 
  FileX2, 
  ScrollText, 
  Sliders, 
  LogOut,
  Shield
} from 'lucide-react';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'organizations', label: 'Organizations', icon: Building2 },
  { id: 'certificates', label: 'Certificates', icon: Award },
  { id: 'verify', label: 'Verify Certificate', icon: ShieldCheck },
  { id: 'revocation', label: 'Revocation', icon: FileX2 },
  { id: 'audit', label: 'Audit Logs', icon: ScrollText },
  { id: 'settings', label: 'Settings', icon: Sliders },
];

export default function Sidebar({ activePage, setActivePage, onLogout, user }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-title">
          <Shield size={18} strokeWidth={2.2} color="#6C96C8" />
          <span>Decentralized PKI</span>
        </div>
        <div className="sidebar-subtitle">Federated Trust Console</div>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActivePage(item.id)}
              className={`nav-item ${isActive ? 'active' : ''}`}
              type="button"
            >
              <Icon size={16} strokeWidth={isActive ? 2.2 : 1.8} />
              <span>{item.label}</span>
            </button>
          );
        })}

        <div style={{ marginTop: 'auto', paddingTop: '12px' }}>
          <button
            onClick={onLogout}
            className="nav-item"
            style={{ color: '#E4A5A5' }}
            type="button"
          >
            <LogOut size={16} strokeWidth={1.8} />
            <span>Logout</span>
          </button>
        </div>
      </nav>

      <div className="sidebar-footer">
        <div>Node: {user?.org_identifier || 'LOCAL'}</div>
        <div style={{ marginTop: '2px', color: '#7E8B9D' }}>Standard Protocol v1.0</div>
      </div>
    </aside>
  );
}

