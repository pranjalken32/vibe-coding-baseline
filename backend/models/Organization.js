const mongoose = require('mongoose');

const organizationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  plan: {
    type: String,
    enum: ['free', 'pro', 'enterprise'],
    default: 'free',
  },
  settings: {
    timezone: { type: String, default: 'UTC' },
    language: { type: String, default: 'en' },
  },
}, { timestamps: true });

module.exports = mongoose.model('Organization', organizationSchema);
