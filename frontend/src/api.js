const API_BASE = '/api';

async function request(url, options = {}) {
  const config = {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  };
  const res = await fetch(`${API_BASE}${url}`, config);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `Request failed: ${res.status}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// Projects
export function getProjects() {
  return request('/projects');
}

export function createProject(name, description = '') {
  return request('/projects', {
    method: 'POST',
    body: JSON.stringify({ name, description }),
  });
}

export function deleteProject(id) {
  return request(`/projects/${id}`, { method: 'DELETE' });
}

// Leads
export function getLeads(projectId, filters = {}) {
  const params = new URLSearchParams({ project_id: projectId, ...filters });
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== null && v !== undefined && v !== '') params.set(k, v);
  });
  return request(`/leads?${params.toString()}`);
}

export function updateLead(id, data) {
  return request(`/leads/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

// Search
export function searchLeads(niche, location, limit = 50, projectId = null) {
  return request('/search', {
    method: 'POST',
    body: JSON.stringify({ niche, location, limit, project_id: projectId }),
  });
}

// Export
export function exportProjectLeads(id) {
  return request(`/projects/${id}/export`);
}