import React from 'react';
import { Building, User, Key } from 'lucide-react';

export default function TopNavbar({ title, user }) {
  return (
    <header className="top-navbar">
      <div className="page-title">{title}</div>

      <div className="navbar-right">
        {user?.org_name && (
          <div className="org-badge">
            <Building size={13} color="#394B64" />
            <span>{user.org_name}</span>
            <span style={{ color: '#707783', fontWeight: 500 }}>[{user.org_identifier}]</span>
          </div>
        )}

        <div className="user-profile-badge">
          <User size={13} />
          <span>{user?.email || 'Administrator'}</span>
          <span style={{ fontSize: '11px', color: '#959DA8' }}>({user?.role || 'ADMIN'})</span>
        </div>
      </div>
    </header>
  );
}

