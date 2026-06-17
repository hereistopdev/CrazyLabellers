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
  getFreelancers: () => request('/admin/freelancers'),
  updateFreelancerStatus: (id, status) =>
    request(`/admin/freelancers/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  getSubmissions: () => request('/admin/submissions'),
  reviewSubmission: (id, body) =>
    request(`/admin/submissions/${id}/review`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  createAssignment: (body) =>
    request('/assignments', { method: 'POST', body: JSON.stringify(body) }),
};
