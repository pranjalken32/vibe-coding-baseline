const express = require('express');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');
const { checkPermission } = require('../middleware/rbac');
const { logAudit } = require('../utils/auditHelper');

const router = express.Router({ mergeParams: true });

router.use(authMiddleware);

router.get('/', checkPermission('user.manage'), async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await User.countDocuments({ orgId: req.user.orgId });
    const users = await User.find({ orgId: req.user.orgId })
      .select('-passwordHash')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: users,
      error: null,
      meta: { page: parseInt(page), limit: parseInt(limit), total },
    });
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: err.message });
  }
});

router.put('/:userId/role', checkPermission('user.manage'), async (req, res) => {
  try {
    const { role } = req.body;
    if (!['admin', 'manager', 'member'].includes(role)) {
      return res.status(400).json({ success: false, data: null, error: 'Invalid role' });
    }

    const user = await User.findOne({ _id: req.params.userId, orgId: req.user.orgId });
    if (!user) {
      return res.status(404).json({ success: false, data: null, error: 'User not found' });
    }

    const before = { role: user.role };
    user.role = role;
    await user.save();

    await logAudit({
      orgId: req.user.orgId,
      userId: req.user._id,
      action: 'user.update',
      resource: 'user',
      resourceId: user._id,
      changes: { before, after: { role } },
      ipAddress: req.ip,
    });

    res.json({ success: true, data: user, error: null });
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: err.message });
  }
});

module.exports = router;
