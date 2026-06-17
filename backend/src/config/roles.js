const LABELLER_ROLES = ['labeller', 'freelancer'];
const REVIEWER_ROLES = ['admin', 'checker'];

function isLabeller(user) {
  return user && LABELLER_ROLES.includes(user.role);
}

function isChecker(user) {
  return user?.role === 'checker';
}

function isAdmin(user) {
  return user?.role === 'admin';
}

function isReviewer(user) {
  return user && REVIEWER_ROLES.includes(user.role);
}

module.exports = {
  LABELLER_ROLES,
  REVIEWER_ROLES,
  isLabeller,
  isChecker,
  isAdmin,
  isReviewer,
};
