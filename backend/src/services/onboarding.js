const VideoAssignment = require('../models/VideoAssignment');
const LabelSubmission = require('../models/LabelSubmission');
const User = require('../models/User');
const { PASS_THRESHOLD } = require('../utils/labelingScore');

const KNOWLEDGE_PASS_SCORE = 80;
const PRETEST_CLIPS_PER_LABELLER = parseInt(process.env.PRETEST_CLIPS_PER_LABELLER, 10) || 3;

function hasPassedKnowledgeTest(user) {
  if (!user) return false;
  if (user.status === 'approved') return true;
  if (user.onboardingOverrides?.knowledgeTest) return true;
  if (user.status === 'passed_test') return true;
  return (user.bestTestScore ?? 0) >= KNOWLEDGE_PASS_SCORE;
}

function hasCompletedTutorials(user) {
  if (!user) return false;
  if (user.status === 'approved') return true;
  if (user.onboardingOverrides?.tutorials) return true;
  return Boolean(user.tutorialsCompleted);
}

function hasPassedLabelingTest(user) {
  if (!user) return false;
  if (user.status === 'approved') return true;
  if (user.onboardingOverrides?.labelingTest) return true;
  if (user.labelingTestPassed) return true;
  return (user.bestLabelingTestScore ?? 0) >= PASS_THRESHOLD;
}

function canAccessTutorial(user) {
  return hasPassedKnowledgeTest(user);
}

function canAccessPretest(user) {
  return hasPassedKnowledgeTest(user) && hasCompletedTutorials(user);
}

function canAccessProduction(user) {
  return canAccessPretest(user) && hasPassedLabelingTest(user);
}

async function getTutorialProgress(userId) {
  const tutorials = await VideoAssignment.find({ kind: 'tutorial' })
    .sort({ sortOrder: 1, createdAt: 1 })
    .select('_id title sortOrder');

  if (tutorials.length === 0) {
    return { total: 0, completed: 0, allCompleted: true, tutorials: [] };
  }

  const submissions = await LabelSubmission.find({
    userId,
    assignmentId: { $in: tutorials.map((t) => t._id) },
    status: { $in: ['submitted', 'approved'] },
  }).select('assignmentId updatedAt');

  const completedSet = new Set(submissions.map((s) => String(s.assignmentId)));

  return {
    total: tutorials.length,
    completed: completedSet.size,
    allCompleted: completedSet.size >= tutorials.length,
    tutorials: tutorials.map((t) => ({
      id: t._id,
      title: t.title,
      completed: completedSet.has(String(t._id)),
      completedAt: submissions.find((s) => String(s.assignmentId) === String(t._id))?.updatedAt,
    })),
  };
}

async function refreshTutorialCompletion(userId) {
  const progress = await getTutorialProgress(userId);
  const user = await User.findById(userId);
  if (!user.onboardingOverrides?.tutorials) {
    user.tutorialsCompleted = progress.allCompleted;
    await user.save();
  }
  return { user, progress };
}

async function ensureTutorialAssignmentsOpen() {
  await VideoAssignment.updateMany(
    { kind: 'tutorial' },
    { $set: { status: 'available', assignedTo: null, taskPrice: 0 } }
  );
}

function shuffleArray(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

async function ensurePretestClipsForUser(userId) {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  if (user.pretestClipIds?.length >= PRETEST_CLIPS_PER_LABELLER) {
    return VideoAssignment.find({ _id: { $in: user.pretestClipIds } }).sort({ createdAt: 1 });
  }

  const pool = await VideoAssignment.find({ kind: 'pretest' }).select('_id').lean();
  if (pool.length < PRETEST_CLIPS_PER_LABELLER) {
    const err = new Error(
      `Pre-test pool needs at least ${PRETEST_CLIPS_PER_LABELLER} clips (currently ${pool.length}). Mark more videos as Pre-test in admin.`
    );
    err.status = 503;
    throw err;
  }

  const picked = shuffleArray(pool)
    .slice(0, PRETEST_CLIPS_PER_LABELLER)
    .map((row) => row._id);

  user.pretestClipIds = picked;
  await user.save();

  return VideoAssignment.find({ _id: { $in: picked } }).sort({ createdAt: 1 });
}

function isPretestClipForUser(user, assignmentId) {
  if (!user?.pretestClipIds?.length) return false;
  return user.pretestClipIds.some((id) => String(id) === String(assignmentId));
}

async function getPretestPoolStats() {
  const total = await VideoAssignment.countDocuments({ kind: 'pretest' });
  return { total, clipsPerLabeller: PRETEST_CLIPS_PER_LABELLER };
}

const ONBOARDING_STEP_LABELS = {
  knowledge: 'Knowledge test',
  tutorials: 'Tutorials',
  labelingTest: 'Video pre-test',
  production: 'Real tasks',
};

function getCurrentOnboardingStep(user, tutorialProgress = null) {
  if (canAccessProduction(user)) return 'production';
  if (canAccessPretest(user) && hasPassedLabelingTest(user)) return 'production';
  if (canAccessPretest(user)) return 'labelingTest';
  if (hasPassedKnowledgeTest(user)) return 'tutorials';
  return 'knowledge';
}

async function getOnboardingStatus(userId) {
  const user = await User.findById(userId).lean();
  if (!user) {
    throw new Error('User not found');
  }

  const tutorialProgress = await getTutorialProgress(userId);
  const pretestPool = await getPretestPoolStats();

  const steps = {
    knowledge: {
      id: 'knowledge',
      label: 'Knowledge test',
      passed: hasPassedKnowledgeTest(user),
      score: user.bestTestScore ?? 0,
      requiredScore: KNOWLEDGE_PASS_SCORE,
      manualGrant: Boolean(user.onboardingOverrides?.knowledgeTest),
    },
    tutorials: {
      id: 'tutorials',
      label: 'Tutorials',
      passed: hasCompletedTutorials(user),
      completed: tutorialProgress.completed,
      total: tutorialProgress.total,
      manualGrant: Boolean(user.onboardingOverrides?.tutorials),
    },
    labelingTest: {
      id: 'labelingTest',
      label: 'Video pre-test',
      passed: hasPassedLabelingTest(user),
      score: user.bestLabelingTestScore ?? 0,
      requiredScore: PASS_THRESHOLD,
      clipsAssigned: user.pretestClipIds?.length ?? 0,
      clipsRequired: PRETEST_CLIPS_PER_LABELLER,
      manualGrant: Boolean(user.onboardingOverrides?.labelingTest),
    },
    production: {
      id: 'production',
      label: 'Real tasks',
      passed: canAccessProduction(user),
      unlocked: canAccessProduction(user),
    },
  };

  return {
    currentStep: getCurrentOnboardingStep(user, tutorialProgress),
    canAccessTutorial: canAccessTutorial(user),
    canAccessPretest: canAccessPretest(user),
    canAccessProduction: canAccessProduction(user),
    pretestPool,
    steps,
    pretestClipIds: user.pretestClipIds || [],
  };
}

async function applyOnboardingGrants(userId, grants = {}) {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('Labeller not found');
  }

  if (!user.onboardingOverrides) {
    user.onboardingOverrides = {};
  }

  if (grants.knowledgeTest === true) {
    user.onboardingOverrides.knowledgeTest = true;
    if (user.status === 'pending') user.status = 'passed_test';
    if ((user.bestTestScore ?? 0) < KNOWLEDGE_PASS_SCORE) {
      user.bestTestScore = KNOWLEDGE_PASS_SCORE;
    }
  } else if (grants.knowledgeTest === false) {
    user.onboardingOverrides.knowledgeTest = false;
  }

  if (grants.tutorials === true) {
    user.onboardingOverrides.tutorials = true;
    user.tutorialsCompleted = true;
  } else if (grants.tutorials === false) {
    user.onboardingOverrides.tutorials = false;
    const { progress } = await refreshTutorialCompletion(userId);
    user.tutorialsCompleted = progress.allCompleted;
  }

  if (grants.labelingTest === true) {
    user.onboardingOverrides.labelingTest = true;
    user.labelingTestPassed = true;
    if ((user.bestLabelingTestScore ?? 0) < PASS_THRESHOLD) {
      user.bestLabelingTestScore = PASS_THRESHOLD;
    }
  } else if (grants.labelingTest === false) {
    user.onboardingOverrides.labelingTest = false;
  }

  if (grants.resetPretestClips === true) {
    user.pretestClipIds = [];
  }

  await user.save();
  return getOnboardingStatus(userId);
}

module.exports = {
  KNOWLEDGE_PASS_SCORE,
  PRETEST_CLIPS_PER_LABELLER,
  ONBOARDING_STEP_LABELS,
  hasPassedKnowledgeTest,
  hasCompletedTutorials,
  hasPassedLabelingTest,
  canAccessTutorial,
  canAccessPretest,
  canAccessProduction,
  getTutorialProgress,
  refreshTutorialCompletion,
  ensureTutorialAssignmentsOpen,
  ensurePretestClipsForUser,
  isPretestClipForUser,
  getPretestPoolStats,
  getCurrentOnboardingStep,
  getOnboardingStatus,
  applyOnboardingGrants,
};
