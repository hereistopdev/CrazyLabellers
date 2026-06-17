const mongoose = require('mongoose');

const terminologySchema = new mongoose.Schema(
  {
    eventType: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    definition: { type: String, required: true },
    criteria: [{ type: String }],
    examples: [{ type: String }],
    commonMistakes: [{ type: String }],
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Terminology', terminologySchema);
