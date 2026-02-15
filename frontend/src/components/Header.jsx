import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!user) return null;

  return (
    <header style={{
      background: 'white',
      borderBottom: '1px solid #e2e8f0',
      padding: '12px 0',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <Link to="/" style={{ fontWeight: 700, fontSize: '18px', color: '#1a202c' }}>
            TaskManager
          </Link>
          <nav style={{ display: 'flex', gap: '16px' }}>
            <Link to="/">Dashboard</Link>
            <Link to="/tasks">Tasks</Link>
            {['admin', 'manager'].includes(user.role) && (
              <Link to="/audit-logs">Audit Log</Link>
            )}
          </nav>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '14px', color: '#666' }}>
            {user.name} <span className={`badge ${user.role}`} style={{
              background: user.role === 'admin' ? '#fecaca' : user.role === 'manager' ? '#dbeafe' : '#e8ecef',
              color: user.role === 'admin' ? '#991b1b' : user.role === 'manager' ? '#1e40af' : '#555',
            }}>{user.role}</span>
          </span>
          <button className="secondary" onClick={handleLogout} style={{ padding: '6px 12px', fontSize: '13px' }}>
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
