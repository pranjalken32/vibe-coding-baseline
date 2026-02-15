import { useState, useEffect } from 'react';
import { api } from '../utils/api';

export default function Reports() {
  const [statusData, setStatusData] = useState([]);
  const [priorityData, setPriorityData] = useState([]);
  const [completedData, setCompletedData] = useState([]);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadReportData();
  }, [days]);

  async function loadReportData() {
    try {
      setLoading(true);
      const [status, priority, completed] = await Promise.all([
        api.getStatusDistribution(),
        api.getPriorityDistribution(),
        api.getCompletedOverTime(days),
      ]);
      setStatusData(status.data);
      setPriorityData(priority.data);
      setCompletedData(completed.data);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleExport() {
    try {
      const blob = await api.exportTasksCSV();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tasks-export-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError('Export failed: ' + err.message);
    }
  }

  const statusLabels = { open: 'Open', in_progress: 'In Progress', review: 'Review', done: 'Done' };
  const priorityLabels = { low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical' };
  const statusColors = { open: '#3b82f6', in_progress: '#f59e0b', review: '#8b5cf6', done: '#10b981' };
  const priorityColors = { low: '#6b7280', medium: '#3b82f6', high: '#f59e0b', critical: '#ef4444' };

  if (loading) return <div>Loading reports...</div>;

  return (
    <div>
      <div className="page-header">
        <h1>Reports</h1>
        <button className="btn btn-primary" onClick={handleExport}>
          Export CSV
        </button>
      </div>
      {error && <div className="error-msg">{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px', marginBottom: '30px' }}>
        {/* Status Distribution */}
        <div className="card">
          <h2 style={{ fontSize: '18px', marginBottom: '20px' }}>Task Distribution by Status</h2>
          <BarChart data={statusData} labelKey="status" valueKey="count" labels={statusLabels} colors={statusColors} />
        </div>

        {/* Priority Distribution */}
        <div className="card">
          <h2 style={{ fontSize: '18px', marginBottom: '20px' }}>Task Distribution by Priority</h2>
          <BarChart data={priorityData} labelKey="priority" valueKey="count" labels={priorityLabels} colors={priorityColors} />
        </div>
      </div>

      {/* Completed Over Time */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '18px' }}>Tasks Completed Over Time</h2>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            style={{
              padding: '6px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              fontSize: '14px',
            }}
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
            <option value={60}>Last 60 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>
        <LineChart data={completedData} />
      </div>
    </div>
  );
}

function BarChart({ data, labelKey, valueKey, labels, colors }) {
  if (!data || data.length === 0) {
    return <p style={{ color: '#9ca3af', textAlign: 'center' }}>No data available</p>;
  }

  const maxValue = Math.max(...data.map(d => d[valueKey]));
  const total = data.reduce((sum, d) => sum + d[valueKey], 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {data.map((item) => {
        const label = labels[item[labelKey]] || item[labelKey];
        const value = item[valueKey];
        const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
        const barWidth = maxValue > 0 ? (value / maxValue) * 100 : 0;
        const color = colors[item[labelKey]] || '#3b82f6';

        return (
          <div key={item[labelKey]} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
              <span style={{ fontWeight: '500' }}>{label}</span>
              <span style={{ color: '#6b7280' }}>{value} ({percentage}%)</span>
            </div>
            <div style={{ width: '100%', height: '24px', backgroundColor: '#f3f4f6', borderRadius: '4px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${barWidth}%`,
                  height: '100%',
                  backgroundColor: color,
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LineChart({ data }) {
  if (!data || data.length === 0) {
    return <p style={{ color: '#9ca3af', textAlign: 'center' }}>No completed tasks in this period</p>;
  }

  const maxValue = Math.max(...data.map(d => d.count));
  const chartHeight = 250;
  const chartPadding = 40;

  // Create points for the line
  const points = data.map((item, index) => {
    const x = (index / (data.length - 1 || 1)) * 100;
    const y = maxValue > 0 ? ((maxValue - item.count) / maxValue) * (chartHeight - chartPadding) + 20 : chartHeight / 2;
    return { x, y, count: item.count, date: item.date };
  });

  // Create SVG path
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  return (
    <div style={{ position: 'relative', height: `${chartHeight}px`, marginTop: '20px' }}>
      <svg width="100%" height={chartHeight} style={{ overflow: 'visible' }}>
        {/* Grid lines */}
        {[0, 1, 2, 3, 4].map(i => {
          const y = (i / 4) * (chartHeight - chartPadding) + 20;
          const value = Math.round(maxValue * (1 - i / 4));
          return (
            <g key={i}>
              <line
                x1="0"
                y1={y}
                x2="100%"
                y2={y}
                stroke="#e5e7eb"
                strokeWidth="1"
              />
              <text
                x="0"
                y={y - 5}
                fill="#6b7280"
                fontSize="12"
              >
                {value}
              </text>
            </g>
          );
        })}

        {/* Line path */}
        <path
          d={pathD}
          fill="none"
          stroke="#3b82f6"
          strokeWidth="3"
          vectorEffect="non-scaling-stroke"
        />

        {/* Data points */}
        {points.map((p, i) => (
          <g key={i}>
            <circle
              cx={`${p.x}%`}
              cy={p.y}
              r="4"
              fill="#3b82f6"
              stroke="white"
              strokeWidth="2"
            />
            <title>{`${p.date}: ${p.count} tasks`}</title>
          </g>
        ))}
      </svg>

      {/* X-axis labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontSize: '12px', color: '#6b7280' }}>
        {data.length > 0 && <span>{new Date(data[0].date).toLocaleDateString()}</span>}
        {data.length > 1 && <span>{new Date(data[data.length - 1].date).toLocaleDateString()}</span>}
      </div>
    </div>
  );
}
