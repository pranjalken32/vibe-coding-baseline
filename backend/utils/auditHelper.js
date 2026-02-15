const AuditLog = require('../models/AuditLog');

async function logAudit({ orgId, userId, action, resource, resourceId, changes, ipAddress }) {
  try {
    await AuditLog.create({
      orgId,
      userId,
      action,
      resource,
      resourceId,
      changes,
      ipAddress,
    });
  } catch (err) {
    console.error('Audit log error:', err.message);
  }
}

module.exports = { logAudit };
