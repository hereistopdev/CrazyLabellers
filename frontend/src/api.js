import { getExportFilename, getReferenceExportFilename } from './utils/exportAnnotation';

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
    const error = new Error(data.message || `Request failed (${response.status})`);
    error.code = data.code;
    error.issues = data.issues;
    error.affectedIndices = data.affectedIndices;
    throw error;
  }

  return data;
}

function parseDownloadFilename(disposition, fallbackFilename) {
  if (!disposition) return fallbackFilename;

  const quoted = disposition.match(/filename="([^"]+)"/i);
  if (quoted?.[1]) return quoted[1];

  const unquoted = disposition.match(/filename=([^;]+)/i);
  if (unquoted?.[1]) return unquoted[1].trim().replace(/^["']|["']$/g, '');

  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (encoded?.[1]) {
    try {
      return decodeURIComponent(encoded[1]);
    } catch {
      return encoded[1];
    }
  }

  return fallbackFilename;
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
  const filename = parseDownloadFilename(
    response.headers.get('Content-Disposition') || '',
    fallbackFilename
  );

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
  getAdminTestQuestions: () => request('/tests/questions/all'),
  submitTest: (answers) =>
    request('/tests/submit', { method: 'POST', body: JSON.stringify({ answers }) }),
  getTestResults: () => request('/tests/results'),
  getAssignments: (kind) =>
    request(kind ? `/assignments?kind=${kind}` : '/assignments'),
  resolveAssignmentUrl: (url) =>
    request(`/assignments/resolve-url?url=${encodeURIComponent(url)}`),
  getLabelingTestStatus: () => request('/labeling-test/status'),
  getLabelingTestAssignments: () => request('/labeling-test/assignments'),
  getLabelingTestResults: () => request('/labeling-test/results'),
  getPretestScoreReview: (assignmentId) =>
    request(`/labeling-test/assignments/${assignmentId}/score-review`),
  acknowledgePretestScoreReview: (assignmentId) =>
    request(`/labeling-test/assignments/${assignmentId}/score-review/acknowledge`, {
      method: 'POST',
    }),
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
  reassignTaskLabeller: (assignmentId, labellerId) =>
    request(`/admin/tasks/${assignmentId}/labeller`, {
      method: 'PATCH',
      body: JSON.stringify({ labellerId: labellerId || null }),
    }),
  setupPretestClips: (pretestCount) =>
    request('/labeling-test/setup-clips', {
      method: 'POST',
      body: JSON.stringify({ pretestCount }),
    }),
  getAssignment: (id) => request(`/assignments/${id}`),
  getAssignmentReference: (id) => request(`/assignments/${id}/reference`),
  claimAssignment: (id) => request(`/assignments/${id}/claim`, { method: 'POST' }),
  getLabels: (id) => request(`/assignments/${id}/labels`),
  saveLabels: (id, body) =>
    request(`/assignments/${id}/labels`, { method: 'PUT', body: JSON.stringify(body) }),
  resetLabelsFromReference: (id) =>
    request(`/assignments/${id}/labels/reset-from-reference`, { method: 'POST' }),
  exportLabels: (id, variant = 'post', exportName) =>
    downloadRequest(
      `/assignments/${id}/export?variant=${variant}`,
      exportName ? getExportFilename(exportName, variant) : `labels_${variant}.json`
    ),
  exportGroupLabels: (groupId, variant = 'post') =>
    downloadRequest(`/assignments/groups/${groupId}/export?variant=${variant}`, 'group.zip'),
  exportAdminGroupLabels: (groupId, variant = 'post') =>
    downloadRequest(`/admin/tasks/groups/${groupId}/export?variant=${variant}`, 'group.zip'),
  exportReviewGroupLabels: (groupId, variant = 'post') =>
    downloadRequest(`/review/groups/${groupId}/export?variant=${variant}`, 'group.zip'),
  exportReviewSubmission: (id, variant = 'post', exportName) =>
    downloadRequest(
      `/review/submissions/${id}/export?variant=${variant}`,
      exportName ? getExportFilename(exportName, variant) : `labels_${variant}.json`
    ),
  exportReviewReference: (id, variant = 'post', exportName) =>
    downloadRequest(
      `/review/submissions/${id}/reference-export?variant=${variant}`,
      exportName ? getReferenceExportFilename(exportName, variant) : `reference_${variant}.json`
    ),
  exportSubmission: (id, variant = 'post', exportName) =>
    downloadRequest(
      `/review/submissions/${id}/export?variant=${variant}`,
      exportName ? getExportFilename(exportName, variant) : `labels_${variant}.json`
    ),
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
  updateReviewReference: (assignmentId, body) =>
    request(`/review/assignments/${assignmentId}/reference`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  updateReviewSubmissionEvents: (id, body) =>
    request(`/review/submissions/${id}/events`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  reopenSubmissionForRelabel: (id, body = {}) =>
    request(`/review/submissions/${id}/reopen-for-relabel`, {
      method: 'POST',
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
  getVideoManagers: () => request('/admin/video-managers'),
  createVideoManager: (body) =>
    request('/admin/video-managers', { method: 'POST', body: JSON.stringify(body) }),
  deleteVideoManager: (id) => request(`/admin/video-managers/${id}`, { method: 'DELETE' }),
  updateVideoManagerStatus: (id, status) =>
    request(`/admin/video-managers/${id}/status`, {
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
  clearLabellerEarnings: (id, body = {}) =>
    request(`/admin/finance/labellers/${id}/clear-earnings`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  getFinanceLabellers: () => request('/admin/finance/labellers'),
  getMyEarnings: () => request('/earnings/me'),
  getMyPaymentAddresses: () => request('/labellers/me/payment-addresses'),
  updateMyPaymentAddresses: (body) =>
    request('/labellers/me/payment-addresses', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  getMyBadges: () => request('/labellers/me/badges'),
  getMyProfile: () => request('/labellers/me/profile'),
  getLabellerProfile: (id) => request(`/labellers/${id}/profile`),
  updateAssignmentPrice: (id, body) =>
    request(`/admin/assignments/${id}/price`, { method: 'PATCH', body: JSON.stringify(body) }),
  bulkUpdateAssignmentPrice: (body) =>
    request('/admin/assignments/bulk-price', { method: 'PATCH', body: JSON.stringify(body) }),
  sendHelpChat: (body) =>
    request('/help/chat', { method: 'POST', body: JSON.stringify(body) }),
  getHelpConversation: (id) => request(`/help/conversations/${id}`),
  getFrequentQA: ({ search, eventType, all } = {}) => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (eventType) params.set('eventType', eventType);
    if (all) params.set('all', 'true');
    const qs = params.toString();
    return request(`/help/faq${qs ? `?${qs}` : ''}`);
  },
  getFrequentQAEntry: (id) => request(`/help/faq/${id}`),
  updateFrequentQA: (id, body) =>
    request(`/help/faq/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteFrequentQA: (id) => request(`/help/faq/${id}`, { method: 'DELETE' }),
  getImageAssignments: () => request('/image-assignments'),
  getImageGroups: () => request('/image-assignments/groups'),
  getImageGroupWorkspace: (groupId) => request(`/image-assignments/groups/${groupId}`),
  claimImageGroup: (groupId) =>
    request(`/image-assignments/groups/${groupId}/claim`, { method: 'POST' }),
  submitImageGroup: (groupId, body) =>
    request(`/image-assignments/groups/${groupId}/submit`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  getImageAssignment: (id) => request(`/image-assignments/${id}`),
  getImageGroupNav: (groupId) => request(`/image-assignments/groups/${groupId}/nav`),
  claimImageAssignment: (id) => request(`/image-assignments/${id}/claim`, { method: 'POST' }),
  getImageKeypoints: (id) => request(`/image-assignments/${id}/keypoints`),
  saveImageKeypoints: (id, body) =>
    request(`/image-assignments/${id}/keypoints`, { method: 'PUT', body: JSON.stringify(body) }),
  submitImageKeypoints: (id) =>
    request(`/image-assignments/${id}/submit`, { method: 'POST' }),
  exportImageKeypoints: (id) =>
    downloadRequest(`/image-assignments/${id}/export`, 'keypoints.json'),
  getAdminImages: () => request('/admin/images'),
  uploadImages: (formData) => uploadRequest('/admin/images/upload', formData),
  deleteAdminImage: (id) => request(`/admin/images/${id}`, { method: 'DELETE' }),
};
