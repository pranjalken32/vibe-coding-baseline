const express = require('express');
const AuditLog = require('../models/AuditLog');
const { authMiddleware } = require('../middleware/auth');
const { checkPermission } = require('../middleware/rbac');

const router = express.Router();

router.use(authMiddleware);

router.get('/', checkPermission('read', 'auditLogs'), async (req, res) => {
  try {
    const { orgId } = req.user;
    const { page = 1, limit = 50, action, resource } = req.query;
    const filter = { orgId };
    if (action) filter.action = action;
    if (resource) filter.resource = resource;

    const total = await AuditLog.countDocuments(filter);
    const logs = await AuditLog.find(filter)
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({
      success: true,
      data: logs,
      error: null,
      meta: { page: Number(page), limit: Number(limit), total },
    });
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: err.message });
  }
});

module.exports = router;
