const LABELLER_ROLES = ['labeller', 'freelancer'];
const VALIDATOR_ROLES = ['checker', 'validator'];
const REVIEWER_ROLES = ['admin', ...VALIDATOR_ROLES];

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

function isReviewer(user) {
  return user && REVIEWER_ROLES.includes(user.role);
}

function canAccessReview(user) {
  if (!user) return false;
  if (isAdmin(user)) return true;
  if (isValidator(user)) return user.status === 'approved';
  return false;
}

module.exports = {
  LABELLER_ROLES,
  VALIDATOR_ROLES,
  REVIEWER_ROLES,
  isLabeller,
  isValidator,
  isChecker,
  isAdmin,
  isReviewer,
  canAccessReview,
};
