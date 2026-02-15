const rolePermissions = {
  admin: [
    'task.create', 'task.read.own', 'task.read.all', 'task.update.own', 'task.update.any',
    'task.delete.own', 'task.delete.any', 'task.assign',
    'report.view', 'report.export',
    'user.manage',
    'audit.view',
    'org.manage',
    'notification.view.own', 'notification.manage',
    'search.all', 'search.own',
    'dashboard.view.all', 'dashboard.view.own',
  ],
  manager: [
    'task.create', 'task.read.own', 'task.read.all', 'task.update.own', 'task.update.any',
    'task.delete.own', 'task.assign',
    'report.view', 'report.export',
    'notification.view.own', 'notification.manage',
    'search.all', 'search.own',
    'dashboard.view.all', 'dashboard.view.own',
  ],
  member: [
    'task.create', 'task.read.own', 'task.update.own', 'task.delete.own',
    'notification.view.own', 'notification.manage',
    'search.own',
    'dashboard.view.own',
  ],
};

function getPermissions(role) {
  return rolePermissions[role] || [];
}

function hasPermission(role, permission) {
  const perms = getPermissions(role);
  return perms.includes(permission);
}

module.exports = { getPermissions, hasPermission, rolePermissions };
