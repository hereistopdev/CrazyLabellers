const mongoose = require('mongoose');

const paymentSettingsSchema = new mongoose.Schema(
  {
    ratePerPoint: { type: Number, default: 0.1 },
    currency: { type: String, default: 'USD' },
    /** When false, labellers only see video labeling tasks (not image keypoint projects). */
    labellerImageLabelingEnabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PaymentSettings', paymentSettingsSchema);
