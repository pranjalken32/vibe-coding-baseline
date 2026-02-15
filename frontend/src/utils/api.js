const API_BASE = '/api/v1';

function getHeaders() {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function getOrgId() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  return user.orgId || '';
}

async function request(method, path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: getHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const api = {
  login: (body) => request('POST', '/auth/login', body),
  register: (body) => request('POST', '/auth/register', body),

  getTasks: (query = '') => request('GET', `/orgs/${getOrgId()}/tasks${query}`),
  getTask: (id) => request('GET', `/orgs/${getOrgId()}/tasks/${id}`),
  createTask: (body) => request('POST', `/orgs/${getOrgId()}/tasks`, body),
  updateTask: (id, body) => request('PUT', `/orgs/${getOrgId()}/tasks/${id}`, body),
  deleteTask: (id) => request('DELETE', `/orgs/${getOrgId()}/tasks/${id}`),

  getDashboard: () => request('GET', `/orgs/${getOrgId()}/dashboard/stats`),
  getAuditLogs: (query = '') => request('GET', `/orgs/${getOrgId()}/audit-logs${query}`),
  getUsers: () => request('GET', `/orgs/${getOrgId()}/users`),
  updateUserRole: (id, role) => request('PUT', `/orgs/${getOrgId()}/users/${id}/role`, { role }),
};
