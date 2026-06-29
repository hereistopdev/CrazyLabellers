const PaymentSettings = require('../models/PaymentSettings');
const { DEFAULT_RATE_PER_POINT } = require('../config/payments');

async function getPlatformSettings() {
  let settings = await PaymentSettings.findOne();
  if (!settings) {
    settings = await PaymentSettings.create({ ratePerPoint: DEFAULT_RATE_PER_POINT });
  }
  return settings;
}

function isLabellerImageLabelingEnabled(settings) {
  return settings?.labellerImageLabelingEnabled !== false;
}

module.exports = {
  getPlatformSettings,
  isLabellerImageLabelingEnabled,
};
