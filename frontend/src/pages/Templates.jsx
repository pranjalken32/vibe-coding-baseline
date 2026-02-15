import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { Link } from 'react-router-dom';

function Templates() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getTaskTemplates()
      .then(response => {
        setTemplates(response.data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const handleCreateTask = async (templateId) => {
    try {
      await api.createTaskFromTemplate({ templateId });
      // Optionally, redirect to the new task or show a success message
      alert('Task created successfully!');
    } catch (err) {
      alert(`Error creating task: ${err.message}`);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Task Templates</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map(template => (
          <div key={template._id} className="bg-white p-4 rounded shadow">
            <h2 className="text-xl font-semibold">{template.name}</h2>
            <p><strong>Title:</strong> {template.title}</p>
            <p><strong>Description:</strong> {template.description}</p>
            <p><strong>Priority:</strong> {template.priority}</p>
            {template.assignee && <p><strong>Assignee:</strong> {template.assignee.name}</p>}
            <button
              onClick={() => handleCreateTask(template._id)}
              className="mt-4 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            >
              Create Task from this Template
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Templates;
