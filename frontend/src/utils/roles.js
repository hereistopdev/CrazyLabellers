export function isAdmin(user) {
  return user?.role === 'admin';
}

export function isValidator(user) {
  return user?.role === 'validator' || user?.role === 'checker';
}

export function isVideoManager(user) {
  return user?.role === 'video_manager';
}

export function isChecker(user) {
  return isValidator(user);
}

export function isReviewer(user) {
  return isAdmin(user) || isValidator(user);
}

export function canAccessReview(user) {
  if (!user) return false;
  if (isAdmin(user)) return true;
  if (isValidator(user)) return user.status === 'approved';
  return false;
}

export function canAccessVideoManagement(user) {
  if (!user) return false;
  if (isAdmin(user)) return true;
  if (isVideoManager(user)) return user.status === 'approved';
  return false;
}

export function isLabeller(user) {
  return user?.role === 'labeller' || user?.role === 'freelancer';
}

export function roleLabel(user) {
  if (isAdmin(user)) return 'Admin';
  if (isVideoManager(user)) return 'Manager';
  if (isValidator(user)) return 'Validator';
  return 'Labeller';
}

export const VALIDATOR_STATUSES = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

export const LABELLER_STATUSES = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'passed_test', label: 'Passed test' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];
