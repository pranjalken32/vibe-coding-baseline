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
      ipAddress: ipAddress || 'unknown',
    });
  } catch (err) {
    console.error('Audit log failed:', err.message);
  }
}

module.exports = { logAudit };
