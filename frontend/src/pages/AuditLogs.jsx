import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

export default function AuditLogs() {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ page: 1, limit: 50, total: 0 });
  const [filterAction, setFilterAction] = useState('');

  useEffect(() => {
    fetchLogs();
  }, [user, page, filterAction]);

  const fetchLogs = async () => {
    try {
      const params = new URLSearchParams({ page, limit: 50 });
      if (filterAction) params.append('action', filterAction);
      const res = await api.get(`/orgs/${user.orgId}/audit-logs?${params}`);
      setLogs(res.data.data);
      setMeta(res.data.meta);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="container" style={{ padding: '40px' }}>Loading audit logs...</div>;

  return (
    <div className="container" style={{ padding: '24px 20px' }}>
      <div className="page-header">
        <h1>Audit Log</h1>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <select value={filterAction} onChange={(e) => { setFilterAction(e.target.value); setPage(1); }} style={{ width: 'auto' }}>
          <option value="">All Actions</option>
          <option value="task.create">Task Created</option>
          <option value="task.update">Task Updated</option>
          <option value="task.delete">Task Deleted</option>
          <option value="task.assign">Task Assigned</option>
          <option value="user.login">User Login</option>
          <option value="user.register">User Register</option>
          <option value="user.update">User Updated</option>
        </select>
      </div>

      {error && <p className="error-message">{error}</p>}

      <div className="card" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
              <th style={{ textAlign: 'left', padding: '8px' }}>Timestamp</th>
              <th style={{ textAlign: 'left', padding: '8px' }}>User</th>
              <th style={{ textAlign: 'left', padding: '8px' }}>Action</th>
              <th style={{ textAlign: 'left', padding: '8px' }}>Resource</th>
              <th style={{ textAlign: 'left', padding: '8px' }}>Details</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log._id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '8px', whiteSpace: 'nowrap' }}>
                  {new Date(log.timestamp).toLocaleString()}
                </td>
                <td style={{ padding: '8px' }}>{log.userId?.name || 'System'}</td>
                <td style={{ padding: '8px' }}>
                  <span style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: '4px', fontSize: '12px' }}>
                    {log.action}
                  </span>
                </td>
                <td style={{ padding: '8px' }}>{log.resource}</td>
                <td style={{ padding: '8px', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {log.changes ? JSON.stringify(log.changes).substring(0, 100) : '-'}
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
                  No audit logs found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {meta.total > meta.limit && (
        <div className="pagination">
          <button className="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
          <span style={{ fontSize: '14px', color: '#666' }}>Page {page} of {Math.ceil(meta.total / meta.limit)}</span>
          <button className="secondary" disabled={page >= Math.ceil(meta.total / meta.limit)} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}
    </div>
  );
}
