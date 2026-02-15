const express = require('express');
const AuditLog = require('../models/AuditLog');
const authMiddleware = require('../middleware/auth');
const { checkPermission } = require('../middleware/rbac');

const router = express.Router({ mergeParams: true });

router.use(authMiddleware);

router.get('/', checkPermission('audit.view'), async (req, res) => {
  try {
    const { page = 1, limit = 50, action, resource, userId, from, to } = req.query;
    const filter = { orgId: req.user.orgId };

    if (action) filter.action = action;
    if (resource) filter.resource = resource;
    if (userId) filter.userId = userId;
    if (from || to) {
      filter.timestamp = {};
      if (from) filter.timestamp.$gte = new Date(from);
      if (to) filter.timestamp.$lte = new Date(to);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await AuditLog.countDocuments(filter);
    const logs = await AuditLog.find(filter)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('userId', 'name email');

    res.json({
      success: true,
      data: logs,
      error: null,
      meta: { page: parseInt(page), limit: parseInt(limit), total },
    });
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: err.message });
  }
});

module.exports = router;
