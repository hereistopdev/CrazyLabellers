const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6 },
    role: {
      type: String,
      enum: ['labeller', 'freelancer', 'admin', 'checker', 'validator'],
      default: 'labeller',
    },
    status: {
      type: String,
      enum: ['pending', 'passed_test', 'approved', 'rejected'],
      default: 'pending',
    },
    bestTestScore: { type: Number, default: 0 },
    testAttempts: { type: Number, default: 0 },
    bestLabelingTestScore: { type: Number, default: 0 },
    labelingTestAttempts: { type: Number, default: 0 },
    labelingTestPassed: { type: Boolean, default: false },
    tutorialsCompleted: { type: Boolean, default: false },
    pretestClipIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'VideoAssignment' }],
    onboardingOverrides: {
      knowledgeTest: { type: Boolean, default: false },
      tutorials: { type: Boolean, default: false },
      labelingTest: { type: Boolean, default: false },
    },
    paymentAddresses: {
      trc20: { type: String, trim: true, default: '' },
      erc20: { type: String, trim: true, default: '' },
      bep20: { type: String, trim: true, default: '' },
    },
    paymentAddressesUpdatedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  return next();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model('User', userSchema);
