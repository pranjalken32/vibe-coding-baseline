import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Header() {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <nav className="nav">
      <div className="container">
        <Link to="/" className="nav-brand">ETMP</Link>
        <div className="nav-links">
          <Link to="/">Dashboard</Link>
          <Link to="/tasks">Tasks</Link>
          {(user.role === 'admin' || user.role === 'manager') && (
            <Link to="/audit-logs">Audit Logs</Link>
          )}
          <span style={{ color: '#6b7280', fontSize: '14px' }}>
            {user.name} ({user.role})
          </span>
          <button className="btn btn-secondary" onClick={logout} style={{ padding: '4px 12px', fontSize: '13px' }}>
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
