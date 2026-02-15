import React from 'react';

const priorityColors = {
  low: { bg: '#e8ecef', color: '#555' },
  medium: { bg: '#dbeafe', color: '#1e40af' },
  high: { bg: '#fed7aa', color: '#c2410c' },
  critical: { bg: '#fecaca', color: '#991b1b' },
};

export default function TaskCard({ task, onEdit, onDelete, canEdit, canDelete }) {
  const pColor = priorityColors[task.priority] || priorityColors.medium;

  return (
    <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600 }}>{task.title}</h3>
          <span className={`badge ${task.status}`}>{task.status}</span>
          <span className="badge" style={{ background: pColor.bg, color: pColor.color }}>{task.priority}</span>
        </div>
        {task.description && (
          <p style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>{task.description}</p>
        )}
        <div style={{ fontSize: '13px', color: '#999', display: 'flex', gap: '16px' }}>
          {task.assigneeId && (
            <span>Assigned to: {task.assigneeId.name || 'Unknown'}</span>
          )}
          {task.dueDate && (
            <span>Due: {new Date(task.dueDate).toLocaleDateString()}</span>
          )}
          <span>Created by: {task.createdBy?.name || 'Unknown'}</span>
        </div>
        {task.tags && task.tags.length > 0 && (
          <div style={{ marginTop: '6px', display: 'flex', gap: '4px' }}>
            {task.tags.map((tag) => (
              <span key={tag} style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: '4px', fontSize: '12px' }}>{tag}</span>
            ))}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: '8px', marginLeft: '12px' }}>
        {canEdit && (
          <button className="secondary" onClick={() => onEdit(task)} style={{ padding: '4px 10px', fontSize: '13px' }}>
            Edit
          </button>
        )}
        {canDelete && (
          <button className="danger" onClick={() => onDelete(task._id)} style={{ padding: '4px 10px', fontSize: '13px' }}>
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
