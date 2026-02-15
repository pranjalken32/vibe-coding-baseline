import { useState, useEffect } from 'react';
import { api } from '../utils/api';

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getAuditLogs()
      .then(res => setLogs(res.data))
      .catch(err => setError(err.message));
  }, []);

  return (
    <div>
      <div className="page-header">
        <h1>Audit Logs</h1>
      </div>
      {error && <div className="error-msg">{error}</div>}
      {logs.length === 0 ? (
        <p style={{ color: '#9ca3af' }}>No audit logs yet.</p>
      ) : (
        <div className="card" style={{ overflow: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Action</th>
                <th>Resource</th>
                <th>User ID</th>
                <th>Changes</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log._id}>
                  <td><span className="badge" style={{ background: '#e5e7eb' }}>{log.action}</span></td>
                  <td>{log.resource}</td>
                  <td style={{ fontSize: '12px' }}>{log.userId}</td>
                  <td style={{ fontSize: '12px', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {JSON.stringify(log.changes)}
                  </td>
                  <td style={{ fontSize: '12px' }}>{new Date(log.timestamp).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
