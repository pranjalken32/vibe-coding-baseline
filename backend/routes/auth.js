const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Organization = require('../models/Organization');
const { logAudit } = require('../utils/auditHelper');

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, orgName, orgSlug, role } = req.body;

    if (!name || !email || !password || !orgName) {
      return res.status(400).json({ success: false, data: null, error: 'Missing required fields' });
    }

    let org = await Organization.findOne({ slug: orgSlug || orgName.toLowerCase().replace(/\s+/g, '-') });
    if (!org) {
      org = await Organization.create({
        name: orgName,
        slug: orgSlug || orgName.toLowerCase().replace(/\s+/g, '-'),
      });
    }

    const existingUser = await User.findOne({ email, orgId: org._id });
    if (existingUser) {
      return res.status(409).json({ success: false, data: null, error: 'User already exists in this organization' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const isFirstUser = (await User.countDocuments({ orgId: org._id })) === 0;

    const user = await User.create({
      orgId: org._id,
      name,
      email,
      passwordHash,
      role: isFirstUser ? 'admin' : (role || 'member'),
    });

    await logAudit({
      orgId: org._id,
      userId: user._id,
      action: 'user.register',
      resource: 'user',
      resourceId: user._id,
      changes: { after: { name, email, role: user.role } },
      ipAddress: req.ip,
    });

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '24h' });

    res.status(201).json({
      success: true,
      data: {
        token,
        user: {
          _id: user._id,
          orgId: user.orgId,
          name: user.name,
          email: user.email,
          role: user.role,
        },
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

    if (!email || !password) {
      return res.status(400).json({ success: false, data: null, error: 'Email and password required' });
    }

    const query = { email };
    if (orgSlug) {
      const org = await Organization.findOne({ slug: orgSlug });
      if (!org) {
        return res.status(404).json({ success: false, data: null, error: 'Organization not found' });
      }
      query.orgId = org._id;
    }

    const user = await User.findOne(query);
    if (!user) {
      return res.status(401).json({ success: false, data: null, error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ success: false, data: null, error: 'Invalid credentials' });
    }

    user.lastLoginAt = new Date();
    await user.save();

    await logAudit({
      orgId: user.orgId,
      userId: user._id,
      action: 'user.login',
      resource: 'user',
      resourceId: user._id,
      changes: {},
      ipAddress: req.ip,
    });

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '24h' });

    res.json({
      success: true,
      data: {
        token,
        user: {
          _id: user._id,
          orgId: user.orgId,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
      error: null,
    });
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: err.message });
  }
});

router.get('/me', require('../middleware/auth'), async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-passwordHash');
    res.json({ success: true, data: user, error: null });
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: err.message });
  }
});

module.exports = router;
