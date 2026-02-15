import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';
import TaskCard from '../components/TaskCard';
import TaskForm from '../components/TaskForm';

export default function Tasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [error, setError] = useState('');

  const canEdit = ['admin', 'manager', 'member'].includes(user?.role);
  const canDelete = user?.role === 'admin';
  const canCreate = ['admin', 'manager', 'member'].includes(user?.role);

  useEffect(() => {
    loadTasks();
    api.getUsers().then(res => setUsers(res.data)).catch(() => {});
  }, []);

  async function loadTasks() {
    try {
      const res = await api.getTasks();
      setTasks(res.data);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSubmit(formData) {
    try {
      if (editingTask) {
        await api.updateTask(editingTask._id, formData);
      } else {
        await api.createTask(formData);
      }
      setShowForm(false);
      setEditingTask(null);
      loadTasks();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this task?')) return;
    try {
      await api.deleteTask(id);
      loadTasks();
    } catch (err) {
      setError(err.message);
    }
  }

  function handleEdit(task) {
    setEditingTask(task);
    setShowForm(true);
  }

  return (
    <div>
      <div className="page-header">
        <h1>Tasks</h1>
        {canCreate && !showForm && (
          <button className="btn btn-primary" onClick={() => { setEditingTask(null); setShowForm(true); }}>
            New Task
          </button>
        )}
      </div>
      {error && <div className="error-msg">{error}</div>}
      {showForm && (
        <TaskForm
          task={editingTask}
          users={users}
          onSubmit={handleSubmit}
          onCancel={() => { setShowForm(false); setEditingTask(null); }}
        />
      )}
      {tasks.length === 0 ? (
        <p style={{ color: '#9ca3af' }}>No tasks yet.</p>
      ) : (
        tasks.map(task => (
          <TaskCard
            key={task._id}
            task={task}
            onEdit={handleEdit}
            onDelete={handleDelete}
            canEdit={canEdit}
            canDelete={canDelete}
          />
        ))
      )}
    </div>
  );
}
