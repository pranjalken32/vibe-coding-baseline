import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import TaskCard from '../components/TaskCard';
import TaskForm from '../components/TaskForm';

export default function Tasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0 });
  const [filters, setFilters] = useState({ status: '', priority: '' });

  useEffect(() => {
    fetchTasks();
  }, [user, page, filters]);

  useEffect(() => {
    if (['admin', 'manager'].includes(user.role)) {
      fetchUsers();
    }
  }, [user]);

  const fetchTasks = async () => {
    try {
      const params = new URLSearchParams({ page, limit: 20 });
      if (filters.status) params.append('status', filters.status);
      if (filters.priority) params.append('priority', filters.priority);

      const res = await api.get(`/orgs/${user.orgId}/tasks?${params}`);
      setTasks(res.data.data);
      setMeta(res.data.meta);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await api.get(`/orgs/${user.orgId}/users`);
      setUsers(res.data.data);
    } catch {
      // silently fail for non-admins
    }
  };

  const handleCreate = async (data) => {
    try {
      await api.post(`/orgs/${user.orgId}/tasks`, data);
      setShowForm(false);
      fetchTasks();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create task');
    }
  };

  const handleUpdate = async (data) => {
    try {
      await api.put(`/orgs/${user.orgId}/tasks/${editingTask._id}`, data);
      setEditingTask(null);
      fetchTasks();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update task');
    }
  };

  const handleDelete = async (taskId) => {
    if (!window.confirm('Delete this task?')) return;
    try {
      await api.delete(`/orgs/${user.orgId}/tasks/${taskId}`);
      fetchTasks();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete task');
    }
  };

  const canEditTask = (task) => {
    if (['admin', 'manager'].includes(user.role)) return true;
    return task.createdBy?._id === user._id || task.assigneeId?._id === user._id;
  };

  const canDeleteTask = (task) => {
    if (user.role === 'admin') return true;
    return task.createdBy?._id === user._id;
  };

  if (loading) return <div className="container" style={{ padding: '40px' }}>Loading tasks...</div>;

  return (
    <div className="container" style={{ padding: '24px 20px' }}>
      <div className="page-header">
        <h1>Tasks</h1>
        <button className="primary" onClick={() => setShowForm(true)}>New Task</button>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
        <select value={filters.status} onChange={(e) => { setFilters({ ...filters, status: e.target.value }); setPage(1); }} style={{ width: 'auto' }}>
          <option value="">All Statuses</option>
          <option value="todo">Todo</option>
          <option value="in-progress">In Progress</option>
          <option value="review">Review</option>
          <option value="done">Done</option>
        </select>
        <select value={filters.priority} onChange={(e) => { setFilters({ ...filters, priority: e.target.value }); setPage(1); }} style={{ width: 'auto' }}>
          <option value="">All Priorities</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
      </div>

      {error && <p className="error-message">{error}</p>}

      <div className="task-list">
        {tasks.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', color: '#999' }}>
            No tasks found. Create your first task!
          </div>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task._id}
              task={task}
              onEdit={setEditingTask}
              onDelete={handleDelete}
              canEdit={canEditTask(task)}
              canDelete={canDeleteTask(task)}
            />
          ))
        )}
      </div>

      {meta.total > meta.limit && (
        <div className="pagination">
          <button className="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
          <span style={{ fontSize: '14px', color: '#666' }}>Page {page} of {Math.ceil(meta.total / meta.limit)}</span>
          <button className="secondary" disabled={page >= Math.ceil(meta.total / meta.limit)} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}

      {showForm && (
        <TaskForm users={users} onSubmit={handleCreate} onClose={() => setShowForm(false)} />
      )}
      {editingTask && (
        <TaskForm task={editingTask} users={users} onSubmit={handleUpdate} onClose={() => setEditingTask(null)} />
      )}
    </div>
  );
}
