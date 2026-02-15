import React, { useState, useEffect } from 'react';

export default function TaskForm({ task, users, onSubmit, onClose }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'todo',
    priority: 'medium',
    assigneeId: '',
    tags: '',
    dueDate: '',
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title || '',
        description: task.description || '',
        status: task.status || 'todo',
        priority: task.priority || 'medium',
        assigneeId: task.assigneeId?._id || task.assigneeId || '',
        tags: task.tags?.join(', ') || '',
        dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '',
      });
    }
  }, [task]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setError('Title is required');
      return;
    }
    const data = {
      ...formData,
      tags: formData.tags ? formData.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      assigneeId: formData.assigneeId || null,
      dueDate: formData.dueDate || null,
    };
    onSubmit(data);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{task ? 'Edit Task' : 'New Task'}</h2>
        {error && <p className="error-message">{error}</p>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Title</label>
            <input name="title" value={formData.title} onChange={handleChange} maxLength={200} />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea name="description" value={formData.description} onChange={handleChange} rows={3} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label>Status</label>
              <select name="status" value={formData.status} onChange={handleChange}>
                <option value="todo">Todo</option>
                <option value="in-progress">In Progress</option>
                <option value="review">Review</option>
                <option value="done">Done</option>
              </select>
            </div>
            <div className="form-group">
              <label>Priority</label>
              <select name="priority" value={formData.priority} onChange={handleChange}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Assignee</label>
            <select name="assigneeId" value={formData.assigneeId} onChange={handleChange}>
              <option value="">Unassigned</option>
              {users && users.map((u) => (
                <option key={u._id} value={u._id}>{u.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Tags (comma separated)</label>
            <input name="tags" value={formData.tags} onChange={handleChange} placeholder="bug, feature, urgent" />
          </div>
          <div className="form-group">
            <label>Due Date</label>
            <input type="date" name="dueDate" value={formData.dueDate} onChange={handleChange} />
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
            <button type="button" className="secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary">{task ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
