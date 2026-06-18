import { isAdmin, isValidator, isLabeller } from './roles';

export function canUseLabeler(user) {
  return isLabeller(user) || isAdmin(user) || isValidator(user);
}

export function labelerPath(assignmentId) {
  return `/label/${assignmentId}`;
}

export function openLabelerRow(navigate, assignmentId, event) {
  if (!assignmentId) return;
  if (event.target.closest('input, select, button, a, label, textarea')) return;
  navigate(labelerPath(assignmentId));
}
