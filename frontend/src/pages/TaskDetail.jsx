import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../utils/api';

function formatStatus(status) {
  if (!status) return '';
  return status.replace(/_/g, ' ');
}

function timeAgo(dateStr) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function renderCommentText(text) {
  const parts = String(text || '').split(/(@[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i);
  return parts.map((part, idx) => {
    if (/^@[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(part)) {
      return (
        <span
          key={idx}
          style={{
            background: '#e0f2fe',
            color: '#075985',
            borderRadius: '4px',
            padding: '1px 4px',
            fontWeight: 600,
          }}
        >
          {part}
        </span>
      );
    }
    return <span key={idx}>{part}</span>;
  });
}

function ActivityItem({ item }) {
  const actor = item.actorId?.name || item.actorId?.email || 'Someone';

  let title = '';
  let body = null;

  if (item.type === 'comment') {
    title = `${actor} commented`;
    body = (
      <div style={{ marginTop: '6px', whiteSpace: 'pre-wrap' }}>
        {renderCommentText(item.comment?.body)}
      </div>
    );
  } else if (item.type === 'status_changed') {
    title = `${actor} changed status`;
    body = (
      <div style={{ marginTop: '6px', color: '#6b7280', fontSize: '13px' }}>
        {formatStatus(item.oldStatus)} → <strong style={{ color: '#111827' }}>{formatStatus(item.newStatus)}</strong>
      </div>
    );
  } else if (item.type === 'assigned') {
    const to = item.toAssigneeId?.name || item.toAssigneeId?.email || 'someone';
    title = `${actor} assigned ${to}`;
  } else if (item.type === 'unassigned') {
    title = `${actor} removed the assignee`;
  } else {
    title = `${actor} updated the task`;
  }

  return (
    <div style={{ padding: '12px 0', borderBottom: '1px solid #f3f4f6' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ fontSize: '14px', fontWeight: 600 }}>{title}</div>
        <div style={{ fontSize: '12px', color: '#9ca3af' }}>{timeAgo(item.createdAt)}</div>
      </div>
      {body}
    </div>
  );
}

export default function TaskDetail() {
  const { id } = useParams();
  const [task, setTask] = useState(null);
  const [activity, setActivity] = useState([]);
  const [comment, setComment] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');

  const activitySorted = useMemo(() => {
    return [...activity].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [activity]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function load() {
    setError('');
    try {
      const [taskRes, activityRes] = await Promise.all([
        api.getTask(id),
        api.getTaskActivity(id, '?limit=100'),
      ]);
      setTask(taskRes.data);
      setActivity(activityRes.data || []);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handlePostComment(e) {
    e.preventDefault();
    if (!comment.trim()) return;
    setPosting(true);
    setError('');
    try {
      const res = await api.addTaskComment(id, { body: comment });
      setActivity(prev => [res.data, ...prev]);
      setComment('');
    } catch (err) {
      setError(err.message);
    }
    setPosting(false);
  }

  if (!task) {
    return (
      <div>
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1>Task</h1>
          <Link to="/tasks" className="btn btn-secondary">Back</Link>
        </div>
        {error && <div className="error-msg">{error}</div>}
        <p style={{ color: '#9ca3af' }}>Loading...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ marginBottom: '6px' }}>{task.title}</h1>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span className={`badge ${task.status}`}>{task.status}</span>
            {task.priority && <span className="badge">{task.priority}</span>}
          </div>
        </div>
        <Link to="/tasks" className="btn btn-secondary">Back</Link>
      </div>

      {error && <div className="error-msg">{error}</div>}

      <div className="card" style={{ marginBottom: '16px' }}>
        {task.description ? (
          <p style={{ whiteSpace: 'pre-wrap' }}>{task.description}</p>
        ) : (
          <p style={{ color: '#9ca3af' }}>No description.</p>
        )}
        <div style={{ marginTop: '12px', fontSize: '12px', color: '#6b7280' }}>
          {task.assigneeId?.name && <span>Assignee: {task.assigneeId.name}</span>}
          {task.dueDate && <span style={{ marginLeft: '12px' }}>Due: {new Date(task.dueDate).toLocaleDateString()}</span>}
        </div>
      </div>

      <div className="card" style={{ marginBottom: '16px' }}>
        <h3 style={{ marginBottom: '10px' }}>Comments</h3>
        <form onSubmit={handlePostComment}>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Write a comment. Mention someone with @email@example.com"
            rows={3}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px',
              resize: 'vertical',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
            <div style={{ fontSize: '12px', color: '#9ca3af' }}>
              Tip: use @someone@company.com to notify them.
            </div>
            <button className="btn btn-primary" disabled={posting}>
              {posting ? 'Posting...' : 'Post comment'}
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: '10px' }}>Activity</h3>
        {activitySorted.length === 0 ? (
          <p style={{ color: '#9ca3af' }}>No activity yet.</p>
        ) : (
          <div>
            {activitySorted.map(item => (
              <ActivityItem key={item._id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
