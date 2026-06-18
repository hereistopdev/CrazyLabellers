const express = require('express');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { isLabeller } = require('../config/roles');
const { buildLabellerProfile } = require('../services/labellerProfile');
const {
  validatePaymentAddresses,
  summarizePaymentAddresses,
} = require('../utils/paymentAddresses');

const router = express.Router();

router.get('/me/payment-addresses', auth, async (req, res) => {
  try {
    if (!isLabeller(req.user)) {
      return res.status(403).json({ message: 'Only labellers can manage payout addresses' });
    }

    const user = await User.findById(req.user._id).select('paymentAddresses paymentAddressesUpdatedAt');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.json({
      paymentAddresses: summarizePaymentAddresses(user.paymentAddresses),
      updatedAt: user.paymentAddressesUpdatedAt,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.patch('/me/payment-addresses', auth, async (req, res) => {
  try {
    if (!isLabeller(req.user)) {
      return res.status(403).json({ message: 'Only labellers can manage payout addresses' });
    }

    const { normalized, errors } = validatePaymentAddresses(req.body || {});
    const errorValues = Object.values(errors);
    if (errorValues.length > 0) {
      return res.status(400).json({ message: errorValues[0], errors });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        paymentAddresses: normalized,
        paymentAddressesUpdatedAt: new Date(),
      },
      { new: true }
    ).select('paymentAddresses paymentAddressesUpdatedAt');

    return res.json({
      paymentAddresses: summarizePaymentAddresses(user.paymentAddresses),
      updatedAt: user.paymentAddressesUpdatedAt,
    });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

router.get('/me/profile', auth, async (req, res) => {
  try {
    const profile = await buildLabellerProfile(req.user._id, { viewer: req.user });
    if (!profile) {
      return res.status(404).json({ message: 'Profile not found' });
    }
    return res.json(profile);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.get('/:id/profile', auth, async (req, res) => {
  try {
    const profile = await buildLabellerProfile(req.params.id, { viewer: req.user });
    if (!profile) {
      return res.status(404).json({ message: 'Labeller not found' });
    }
    return res.json(profile);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

module.exports = router;
