const API_BASE = import.meta.env.VITE_API_URL || '/api';

function getToken() {
  return localStorage.getItem('token');
}

async function request(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });
  } catch {
    const hint = import.meta.env.VITE_API_URL
      ? 'Check that the backend is running on Render.'
      : 'Start the backend with: cd backend && npm run dev';
    throw new Error(`Cannot reach the API server. ${hint}`);
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || `Request failed (${response.status})`);
  }

  return data;
}

async function uploadRequest(path, formData) {
  const headers = {};
  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers,
      body: formData,
    });
  } catch {
    throw new Error('Cannot reach the API server. Is the backend running?');
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || `Request failed (${response.status})`);
  }
  return data;
}

export const api = {
  health: () => request('/health'),
  register: (body) => request('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body) => request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  me: () => request('/auth/me'),
  getTerminology: () => request('/terminology'),
  getEvents: () => request('/events'),
  getTestQuestions: (limit = 10) => request(`/tests/questions?limit=${limit}`),
  submitTest: (answers) =>
    request('/tests/submit', { method: 'POST', body: JSON.stringify({ answers }) }),
  getTestResults: () => request('/tests/results'),
  getAssignments: () => request('/assignments'),
  getAssignment: (id) => request(`/assignments/${id}`),
  claimAssignment: (id) => request(`/assignments/${id}/claim`, { method: 'POST' }),
  getLabels: (id) => request(`/assignments/${id}/labels`),
  saveLabels: (id, body) =>
    request(`/assignments/${id}/labels`, { method: 'PUT', body: JSON.stringify(body) }),
  getAdminStats: () => request('/admin/stats'),
  createLabeller: (body) =>
    request('/admin/labellers', { method: 'POST', body: JSON.stringify(body) }),
  deleteLabeller: (id) => request(`/admin/labellers/${id}`, { method: 'DELETE' }),
  getLabellers: (status) =>
    request(status ? `/admin/labellers?status=${status}` : '/admin/labellers'),
  getLabeller: (id) => request(`/admin/labellers/${id}`),
  updateLabellerStatus: (id, status) =>
    request(`/admin/labellers/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  assignToLabeller: (labellerId, assignmentId) =>
    request(`/admin/labellers/${labellerId}/assign`, {
      method: 'POST',
      body: JSON.stringify({ assignmentId }),
    }),
  getAdminAssignments: () => request('/admin/assignments'),
  uploadVideo: (formData) => uploadRequest('/admin/videos', formData),
  deleteVideo: (id, deleteFile = true) =>
    request(`/admin/videos/${id}?deleteFile=${deleteFile}`, { method: 'DELETE' }),
  importClips: () => request('/admin/import-clips', { method: 'POST' }),
  getSubmissions: () => request('/admin/submissions'),
  reviewSubmission: (id, body) =>
    request(`/admin/submissions/${id}/review`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  createAssignment: (body) =>
    request('/assignments', { method: 'POST', body: JSON.stringify(body) }),
  getFinanceDashboard: () => request('/admin/finance/dashboard'),
  getFinanceSettings: () => request('/admin/finance/settings'),
  updateFinanceSettings: (body) =>
    request('/admin/finance/settings', { method: 'PATCH', body: JSON.stringify(body) }),
  getFinanceLabeller: (id) => request(`/admin/finance/labellers/${id}`),
  getFinanceLabellers: () => request('/admin/finance/labellers'),
  getMyEarnings: () => request('/earnings/me'),
};
