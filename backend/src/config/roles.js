const LABELLER_ROLES = ['labeller', 'freelancer'];
const VALIDATOR_ROLES = ['checker', 'validator'];
const REVIEWER_ROLES = ['admin', ...VALIDATOR_ROLES];
const VIDEO_MANAGER_ROLES = ['video_manager'];

function isLabeller(user) {
  return user && LABELLER_ROLES.includes(user.role);
}

function isValidator(user) {
  return user && VALIDATOR_ROLES.includes(user.role);
}

function isChecker(user) {
  return isValidator(user);
}

function isAdmin(user) {
  return user?.role === 'admin';
}

function isVideoManager(user) {
  return user && VIDEO_MANAGER_ROLES.includes(user.role);
}

function isReviewer(user) {
  return user && REVIEWER_ROLES.includes(user.role);
}

function canAccessReview(user) {
  if (!user) return false;
  if (isAdmin(user)) return true;
  if (isValidator(user)) return user.status === 'approved';
  return false;
}

function canAccessVideoManagement(user) {
  if (!user) return false;
  if (isAdmin(user)) return true;
  if (isVideoManager(user)) return user.status === 'approved';
  return false;
}

module.exports = {
  LABELLER_ROLES,
  VALIDATOR_ROLES,
  REVIEWER_ROLES,
  VIDEO_MANAGER_ROLES,
  isLabeller,
  isValidator,
  isChecker,
  isAdmin,
  isVideoManager,
  isReviewer,
  canAccessReview,
  canAccessVideoManagement,
};
