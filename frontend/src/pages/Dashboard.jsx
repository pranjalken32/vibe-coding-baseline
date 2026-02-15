import { useState, useEffect } from 'react';
import { api } from '../utils/api';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getDashboard()
      .then(res => setStats(res.data))
      .catch(err => setError(err.message));
  }, []);

  if (error) return <div className="error-msg">{error}</div>;
  if (!stats) return <div>Loading dashboard...</div>;

  return (
    <div>
      <div className="page-header">
        <h1>Dashboard</h1>
      </div>
      <div className="grid-4">
        <div className="stat-card">
          <div className="number">{stats.totalTasks}</div>
          <div className="label">Total Tasks</div>
        </div>
        <div className="stat-card">
          <div className="number">{stats.openTasks}</div>
          <div className="label">Open</div>
        </div>
        <div className="stat-card">
          <div className="number">{stats.inProgressTasks}</div>
          <div className="label">In Progress</div>
        </div>
        <div className="stat-card">
          <div className="number">{stats.doneTasks}</div>
          <div className="label">Done</div>
        </div>
      </div>
      <div className="grid-2" style={{ marginTop: '20px' }}>
        <div className="stat-card">
          <div className="number">{stats.overdueTasks}</div>
          <div className="label">Overdue</div>
        </div>
        <div className="stat-card">
          <div className="number">{stats.completionRate}%</div>
          <div className="label">Completion Rate</div>
        </div>
      </div>
    </div>
  );
}
