const LABELLER_ROLES = ['labeller', 'freelancer'];

function isLabeller(user) {
  return user && LABELLER_ROLES.includes(user.role);
}

module.exports = { LABELLER_ROLES, isLabeller };
