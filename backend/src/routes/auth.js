const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { isLabeller } = require('../config/roles');
const { getOnboardingStatus } = require('../services/onboarding');

const router = express.Router();

const PUBLIC_REGISTER_ROLES = ['labeller', 'validator'];

function buildAuthUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    bestTestScore: user.bestTestScore,
    bestLabelingTestScore: user.bestLabelingTestScore,
    labelingTestPassed: user.labelingTestPassed,
    tutorialsCompleted: user.tutorialsCompleted,
    labelingTestAttempts: user.labelingTestAttempts,
  };
}

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role: requestedRole } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const role = PUBLIC_REGISTER_ROLES.includes(requestedRole) ? requestedRole : 'labeller';
    const status = role === 'validator' ? 'approved' : 'pending';

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    const user = await User.create({ name, email, password, role, status });
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    return res.status(201).json({
      token,
      user: buildAuthUser(user),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    return res.json({
      token,
      user: buildAuthUser(user),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.get('/me', auth, async (req, res) => {
  const userPayload = {
    id: req.user._id,
    name: req.user.name,
    email: req.user.email,
    role: req.user.role,
    status: req.user.status,
    bestTestScore: req.user.bestTestScore,
    testAttempts: req.user.testAttempts,
    bestLabelingTestScore: req.user.bestLabelingTestScore,
    labelingTestPassed: req.user.labelingTestPassed,
    tutorialsCompleted: req.user.tutorialsCompleted,
    labelingTestAttempts: req.user.labelingTestAttempts,
  };

  if (isLabeller(req.user)) {
    const onboarding = await getOnboardingStatus(req.user._id);
    userPayload.onboarding = {
      currentStep: onboarding.currentStep,
      canAccessTutorial: onboarding.canAccessTutorial,
      canAccessPretest: onboarding.canAccessPretest,
      canAccessProduction: onboarding.canAccessProduction,
      pretestPool: onboarding.pretestPool,
      steps: onboarding.steps,
    };
  }

  return res.json({ user: userPayload });
});

module.exports = router;
