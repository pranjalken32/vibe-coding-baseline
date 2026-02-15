const mongoose = require('mongoose');

const organizationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  plan: { type: String, enum: ['free', 'pro', 'enterprise'], default: 'free' },
  settings: {
    maxUsers: { type: Number, default: 10 },
    maxTasks: { type: Number, default: 100 },
  },
}, { timestamps: true });

module.exports = mongoose.model('Organization', organizationSchema);
