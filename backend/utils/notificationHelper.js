const Notification = require('../models/Notification');

async function createNotification({ orgId, recipientId, type, title, message, taskId, triggeredBy }) {
  try {
    if (String(recipientId) === String(triggeredBy)) return null;
    await Notification.create({
      orgId,
      recipientId,
      type,
      title,
      message,
      taskId,
      triggeredBy,
    });
  } catch (err) {
    console.error('Notification creation failed:', err.message);
  }
}

async function notifyTaskAssigned({ orgId, task, assigneeId, assignedBy }) {
  await createNotification({
    orgId,
    recipientId: assigneeId,
    type: 'task_assigned',
    title: 'Task Assigned',
    message: `You have been assigned to task "${task.title}"`,
    taskId: task._id,
    triggeredBy: assignedBy,
  });
}

async function notifyTaskStatusChanged({ orgId, task, oldStatus, newStatus, changedBy }) {
  if (String(task.createdBy) === String(changedBy)) return;
  const creatorId = task.createdBy._id || task.createdBy;
  await createNotification({
    orgId,
    recipientId: creatorId,
    type: 'task_status_changed',
    title: 'Task Status Updated',
    message: `Task "${task.title}" status changed from "${oldStatus}" to "${newStatus}"`,
    taskId: task._id,
    triggeredBy: changedBy,
  });
}

module.exports = { createNotification, notifyTaskAssigned, notifyTaskStatusChanged };
