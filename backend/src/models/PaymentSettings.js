const mongoose = require('mongoose');

const paymentSettingsSchema = new mongoose.Schema(
  {
    ratePerPoint: { type: Number, default: 0.1 },
    currency: { type: String, default: 'USD' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PaymentSettings', paymentSettingsSchema);
