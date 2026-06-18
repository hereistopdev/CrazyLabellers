function normalizeTutorialSteps(steps) {
  if (!Array.isArray(steps)) return [];

  return steps.map((step) => ({
    frameTime: Number(step?.frameTime) || 0,
    eventType: step?.eventType != null ? String(step.eventType).trim() : '',
    title: step?.title != null ? String(step.title).trim() : '',
    explanation: step?.explanation != null ? String(step.explanation).trim() : '',
  }));
}

module.exports = { normalizeTutorialSteps };
