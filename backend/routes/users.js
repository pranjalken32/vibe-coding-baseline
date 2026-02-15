const express = require('express');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');
const { checkPermission } = require('../middleware/rbac');
const { logAudit } = require('../utils/auditHelper');

const router = express.Router();

router.use(authMiddleware);

router.get('/', checkPermission('read', 'users'), async (req, res) => {
  try {
    const { orgId } = req.user;
    const users = await User.find({ orgId }).select('-passwordHash');

    res.json({ success: true, data: users, error: null });
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: err.message });
  }
});

router.put('/:id/role', checkPermission('changeRole', 'users'), async (req, res) => {
  try {
    const { orgId, id: adminId } = req.user;
    const { role } = req.body;

    if (!['admin', 'manager', 'member'].includes(role)) {
      return res.status(400).json({ success: false, data: null, error: 'Invalid role' });
    }

    const user = await User.findOne({ _id: req.params.id, orgId });
    if (!user) {
      return res.status(404).json({ success: false, data: null, error: 'User not found' });
    }

    const oldRole = user.role;
    user.role = role;
    await user.save();

    await logAudit({
      orgId,
      userId: adminId,
      action: 'update',
      resource: 'user',
      resourceId: user._id,
      changes: { before: { role: oldRole }, after: { role } },
      ipAddress: req.ip,
    });

    res.json({ success: true, data: { id: user._id, name: user.name, role: user.role }, error: null });
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: err.message });
  }
});

module.exports = router;
