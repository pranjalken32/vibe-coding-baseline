const { hasPermission } = require('../utils/permissions');

function checkPermission(permission) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, data: null, error: 'Not authenticated' });
    }

    if (!hasPermission(req.user.role, permission)) {
      return res.status(403).json({ success: false, data: null, error: 'Insufficient permissions' });
    }

    if (req.params.orgId && req.params.orgId !== req.user.orgId.toString()) {
      return res.status(403).json({ success: false, data: null, error: 'Access denied to this organization' });
    }

    next();
  };
}

function checkOrgAccess(req, res, next) {
  if (req.params.orgId && req.params.orgId !== req.user.orgId.toString()) {
    return res.status(403).json({ success: false, data: null, error: 'Access denied to this organization' });
  }
  next();
}

module.exports = { checkPermission, checkOrgAccess };
