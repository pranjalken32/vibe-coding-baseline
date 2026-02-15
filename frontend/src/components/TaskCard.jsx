import { Link } from 'react-router-dom';

const priorityColors = {
  low: { bg: '#d1fae5', color: '#065f46' },
  medium: { bg: '#dbeafe', color: '#1e40af' },
  high: { bg: '#fed7aa', color: '#9a3412' },
  critical: { bg: '#fecaca', color: '#991b1b' },
};

const formatPriority = (priority) => {
  const key = priority?.toLowerCase();
  const colors = priorityColors[key] || priorityColors.medium;
  const label = key ? key.charAt(0).toUpperCase() + key.slice(1) : 'Medium';
  return { colors, label };
};

export default function TaskCard({ task, onEdit, onDelete, canEdit, canDelete }) {
  const { colors: pColor, label: priorityLabel } = formatPriority(task.priority);

  return (
    <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600 }}>
            <Link to={`/tasks/${task._id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
              {task.title}
            </Link>
          </h3>
          <span className={`badge ${task.status}`}>{task.status}</span>
          <span className="badge" style={{ background: pColor.bg, color: pColor.color }}>{priorityLabel}</span>
        </div>
        {task.description && (
          <p style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>{task.description}</p>
        )}
        <div style={{ fontSize: '12px', color: '#9ca3af' }}>
          {task.assigneeId?.name && <span>Assigned to: {task.assigneeId.name}</span>}
          {task.dueDate && <span style={{ marginLeft: '12px' }}>Due: {new Date(task.dueDate).toLocaleDateString()}</span>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '6px' }}>
        {canEdit && <button className="btn btn-primary" onClick={() => onEdit(task)} style={{ padding: '4px 10px', fontSize: '12px' }}>Edit</button>}
        {canDelete && <button className="btn btn-danger" onClick={() => onDelete(task._id)} style={{ padding: '4px 10px', fontSize: '12px' }}>Delete</button>}
      </div>
    </div>
  );
}
