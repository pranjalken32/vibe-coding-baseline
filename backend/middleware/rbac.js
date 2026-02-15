const { getPermissions } = require('../utils/permissions');

function checkPermission(action, resource) {
  return (req, res, next) => {
    const { role } = req.user;
    const permissions = getPermissions(role);

    if (!permissions || !permissions[resource] || !permissions[resource].includes(action)) {
      return res.status(403).json({
        success: false,
        data: null,
        error: `Role '${role}' does not have '${action}' permission on '${resource}'`,
      });
    }

    next();
  };
}

module.exports = { checkPermission };
