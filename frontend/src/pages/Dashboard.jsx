import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

export default function Dashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSummary();
  }, [user]);

  const fetchSummary = async () => {
    try {
      const res = await api.get(`/orgs/${user.orgId}/dashboard/summary`);
      setSummary(res.data.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="container" style={{ padding: '40px' }}>Loading dashboard...</div>;
  if (error) return <div className="container" style={{ padding: '40px' }}><p className="error-message">{error}</p></div>;

  return (
    <div className="container" style={{ padding: '24px 20px' }}>
      <div className="page-header">
        <h1>Dashboard</h1>
        <span style={{ fontSize: '14px', color: '#666' }}>
          {user.role === 'member' ? 'Your Tasks' : 'Organization Overview'}
        </span>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{summary?.totalTasks || 0}</div>
          <div className="stat-label">Total Tasks</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{summary?.completionRate || 0}%</div>
          <div className="stat-label">Completion Rate</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: '#e74c3c' }}>{summary?.overdueTasks || 0}</div>
          <div className="stat-label">Overdue</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div className="card">
          <h3 style={{ marginBottom: '12px' }}>By Status</h3>
          {summary?.byStatus && Object.entries(summary.byStatus).map(([status, count]) => (
            <div key={status} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f0f0f0' }}>
              <span className={`badge ${status}`}>{status}</span>
              <span style={{ fontWeight: 600 }}>{count}</span>
            </div>
          ))}
          {(!summary?.byStatus || Object.keys(summary.byStatus).length === 0) && (
            <p style={{ color: '#999', fontSize: '14px' }}>No tasks yet</p>
          )}
        </div>
        <div className="card">
          <h3 style={{ marginBottom: '12px' }}>By Priority</h3>
          {summary?.byPriority && Object.entries(summary.byPriority).map(([priority, count]) => (
            <div key={priority} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f0f0f0' }}>
              <span className={`badge ${priority}`}>{priority}</span>
              <span style={{ fontWeight: 600 }}>{count}</span>
            </div>
          ))}
          {(!summary?.byPriority || Object.keys(summary.byPriority).length === 0) && (
            <p style={{ color: '#999', fontSize: '14px' }}>No tasks yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
