export function isAdmin(user) {
  return user?.role === 'admin';
}

export function isLabeller(user) {
  return user?.role === 'labeller' || user?.role === 'freelancer';
}

export function roleLabel(user) {
  if (isAdmin(user)) return 'Admin';
  return 'Labeller';
}

export const LABELLER_STATUSES = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'passed_test', label: 'Passed test' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];
