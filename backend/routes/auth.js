const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Organization = require('../models/Organization');
const { generateToken } = require('../middleware/auth');
const { logAudit } = require('../utils/auditHelper');

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, orgName } = req.body;

    if (!name || !email || !password || !orgName) {
      return res.status(400).json({ success: false, data: null, error: 'All fields are required' });
    }

    let org = await Organization.findOne({ slug: orgName.toLowerCase().replace(/\s+/g, '-') });
    if (!org) {
      org = await Organization.create({
        name: orgName,
        slug: orgName.toLowerCase().replace(/\s+/g, '-'),
      });
    }

    const existing = await User.findOne({ orgId: org._id, email });
    if (existing) {
      return res.status(409).json({ success: false, data: null, error: 'User already exists in this organization' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const isFirstUser = (await User.countDocuments({ orgId: org._id })) === 0;

    const user = await User.create({
      orgId: org._id,
      name,
      email,
      passwordHash,
      role: isFirstUser ? 'admin' : 'member',
    });

    await logAudit({
      orgId: org._id,
      userId: user._id,
      action: 'create',
      resource: 'user',
      resourceId: user._id,
      changes: { name, email, role: user.role },
    });

    const token = generateToken(user);
    res.status(201).json({
      success: true,
      data: {
        token,
        user: { id: user._id, name: user.name, email: user.email, role: user.role, orgId: org._id },
      },
      error: null,
    });
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password, orgSlug } = req.body;

    if (!email || !password || !orgSlug) {
      return res.status(400).json({ success: false, data: null, error: 'Email, password, and organization are required' });
    }

    const org = await Organization.findOne({ slug: orgSlug });
    if (!org) {
      return res.status(404).json({ success: false, data: null, error: 'Organization not found' });
    }

    const user = await User.findOne({ orgId: org._id, email });
    if (!user) {
      return res.status(401).json({ success: false, data: null, error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ success: false, data: null, error: 'Invalid credentials' });
    }

    user.lastLoginAt = new Date();
    await user.save();

    const token = generateToken(user);
    res.json({
      success: true,
      data: {
        token,
        user: { id: user._id, name: user.name, email: user.email, role: user.role, orgId: org._id },
      },
      error: null,
    });
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: err.message });
  }
});

module.exports = router;
