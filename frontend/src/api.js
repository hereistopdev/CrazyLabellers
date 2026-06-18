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

async function downloadRequest(path, fallbackFilename) {
  const headers = {};
  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, { headers });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || `Download failed (${response.status})`);
  }

  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match?.[1] || fallbackFilename;

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
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
  getAssignments: (kind) =>
    request(kind ? `/assignments?kind=${kind}` : '/assignments'),
  getLabelingTestStatus: () => request('/labeling-test/status'),
  getLabelingTestAssignments: () => request('/labeling-test/assignments'),
  getLabelingTestResults: () => request('/labeling-test/results'),
  getTutorialStatus: () => request('/tutorials/status'),
  getTutorialAssignments: () => request('/tutorials/assignments'),
  getTutorialAssignment: (id) => request(`/tutorials/assignments/${id}`),
  completeTutorial: (id) =>
    request(`/tutorials/assignments/${id}/complete`, { method: 'POST' }),
  getTaskGroups: () => request('/admin/tasks/groups'),
  createTaskGroup: (body) =>
    request('/admin/tasks/groups', { method: 'POST', body: JSON.stringify(body) }),
  updateTaskGroup: (id, body) =>
    request(`/admin/tasks/groups/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteTaskGroup: (id) => request(`/admin/tasks/groups/${id}`, { method: 'DELETE' }),
  getAdminTasks: (params = {}) => {
    const qs = new URLSearchParams();
    if (params.kind) qs.set('kind', params.kind);
    if (params.groupId) qs.set('groupId', params.groupId);
    const query = qs.toString();
    return request(`/admin/tasks${query ? `?${query}` : ''}`);
  },
  updateAdminTask: (id, body) =>
    request(`/admin/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  setupPretestClips: (pretestCount) =>
    request('/labeling-test/setup-clips', {
      method: 'POST',
      body: JSON.stringify({ pretestCount }),
    }),
  getAssignment: (id) => request(`/assignments/${id}`),
  claimAssignment: (id) => request(`/assignments/${id}/claim`, { method: 'POST' }),
  getLabels: (id) => request(`/assignments/${id}/labels`),
  saveLabels: (id, body) =>
    request(`/assignments/${id}/labels`, { method: 'PUT', body: JSON.stringify(body) }),
  exportLabels: (id, variant = 'post') =>
    downloadRequest(`/assignments/${id}/export?variant=${variant}`, `labels_${variant}.json`),
  exportSubmission: (id, variant = 'post') =>
    downloadRequest(`/admin/submissions/${id}/export?variant=${variant}`, `labels_${variant}.json`),
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
  updateLabellerOnboarding: (id, body) =>
    request(`/admin/labellers/${id}/onboarding`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  assignToLabeller: (labellerId, assignmentId) =>
    request(`/admin/labellers/${labellerId}/assign`, {
      method: 'POST',
      body: JSON.stringify({ assignmentId }),
    }),
  getAdminAssignments: () => request('/admin/assignments'),
  getStorageStatus: () => request('/admin/storage-status'),
  uploadVideo: (formData) => uploadRequest('/admin/videos', formData),
  uploadBulkClip: (formData) => uploadRequest('/admin/videos/bulk-clip', formData),
  uploadAssignmentReference: (assignmentId, formData) =>
    uploadRequest(`/admin/assignments/${assignmentId}/reference`, formData),
  deleteVideo: (id, deleteFile = true) =>
    request(`/admin/videos/${id}?deleteFile=${deleteFile}`, { method: 'DELETE' }),
  importClips: () => request('/admin/import-clips', { method: 'POST' }),
  previewBulkImport: (sourceDir) =>
    request(`/admin/import-folder/preview?sourceDir=${encodeURIComponent(sourceDir)}`),
  importBulkFolder: (body) =>
    request('/admin/import-folder', { method: 'POST', body: JSON.stringify(body) }),
  getSubmissions: () => request('/admin/submissions'),
  reviewSubmission: (id, body) =>
    request(`/review/submissions/${id}/review`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  getReviewSubmissions: (status = 'submitted') =>
    request(`/review/submissions?status=${status}`),
  getReviewAssignments: () => request('/review/assignments'),
  getReviewPreview: (assignmentId, variant = 'post') =>
    request(`/review/assignments/${assignmentId}/preview?variant=${variant}`),
  getReviewSubmission: (id, variant = 'post') =>
    request(`/review/submissions/${id}?variant=${variant}`),
  validateSubmissionEvents: (id, body) =>
    request(`/review/submissions/${id}/validate`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  getValidators: () => request('/admin/validators'),
  createValidator: (body) =>
    request('/admin/validators', { method: 'POST', body: JSON.stringify(body) }),
  deleteValidator: (id) => request(`/admin/validators/${id}`, { method: 'DELETE' }),
  updateValidatorStatus: (id, status) =>
    request(`/admin/validators/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  getCheckers: () => request('/admin/validators'),
  createChecker: (body) =>
    request('/admin/validators', { method: 'POST', body: JSON.stringify(body) }),
  createAssignment: (body) =>
    request('/assignments', { method: 'POST', body: JSON.stringify(body) }),
  getFinanceDashboard: () => request('/admin/finance/dashboard'),
  getFinanceSettings: () => request('/admin/finance/settings'),
  updateFinanceSettings: (body) =>
    request('/admin/finance/settings', { method: 'PATCH', body: JSON.stringify(body) }),
  getFinanceLabeller: (id) => request(`/admin/finance/labellers/${id}`),
  getFinanceLabellers: () => request('/admin/finance/labellers'),
  getMyEarnings: () => request('/earnings/me'),
  getMyProfile: () => request('/labellers/me/profile'),
  getLabellerProfile: (id) => request(`/labellers/${id}/profile`),
  updateAssignmentPrice: (id, body) =>
    request(`/admin/assignments/${id}/price`, { method: 'PATCH', body: JSON.stringify(body) }),
  bulkUpdateAssignmentPrice: (body) =>
    request('/admin/assignments/bulk-price', { method: 'PATCH', body: JSON.stringify(body) }),
};
