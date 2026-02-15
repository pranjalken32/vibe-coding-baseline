const express = require('express');
const Task = require('../models/Task');
const TaskTemplate = require('../models/TaskTemplate');
const TaskActivity = require('../models/TaskActivity');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');
const { checkPermission } = require('../middleware/rbac');
const { logAudit } = require('../utils/auditHelper');
const { notifyTaskAssigned, notifyTaskStatusChanged, notifyTaskMentioned } = require('../utils/notificationHelper');

const router = express.Router();

router.use(authMiddleware);

// New route to create a task from a template
router.post('/from-template', checkPermission('create', 'tasks'), async (req, res) => {
  try {
    const { orgId, id: userId } = req.user;
    const { templateId } = req.body;

    const template = await TaskTemplate.findById(templateId);
    if (!template) {
      return res.status(404).json({ success: false, data: null, error: 'Template not found' });
    }

    const taskData = {
      orgId,
      title: template.title,
      description: template.description,
      priority: template.priority.toLowerCase(),
      assigneeId: template.assignee,
      createdBy: userId,
      templateId: template._id,
    };

    const task = await Task.create(taskData);

    await logAudit({
      orgId,
      userId,
      action: 'create_from_template',
      resource: 'task',
      resourceId: task._id,
      changes: { templateId: template._id },
      ipAddress: req.ip,
    });

    if (task.assigneeId) {
      await notifyTaskAssigned({ orgId, task, assignedBy: userId });
    }

    res.status(201).json({ success: true, data: task, error: null });
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: err.message });
  }
});

function extractMentionEmails(body) {
  if (!body || typeof body !== 'string') return [];
  const matches = body.match(/@([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi) || [];
  return [...new Set(matches.map(m => m.slice(1).toLowerCase()))];
}

async function populateActivity(activityDoc) {
  return TaskActivity.findById(activityDoc._id)
    .populate('actorId', 'name email')
    .populate('fromAssigneeId', 'name email')
    .populate('toAssigneeId', 'name email')
    .populate('comment.mentions', 'name email');
}

router.get('/:id/activity', checkPermission('read', 'tasks'), async (req, res) => {
  try {
    const { orgId } = req.user;
    const { limit = 50 } = req.query;

    const task = await Task.findOne({ _id: req.params.id, orgId }).select('_id');
    if (!task) {
      return res.status(404).json({ success: false, data: null, error: 'Task not found' });
    }

    const items = await TaskActivity.find({ orgId, taskId: task._id })
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .populate('actorId', 'name email')
      .populate('fromAssigneeId', 'name email')
      .populate('toAssigneeId', 'name email')
      .populate('comment.mentions', 'name email');

    res.json({ success: true, data: items, error: null });
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: err.message });
  }
});

router.post('/:id/comments', checkPermission('read', 'tasks'), async (req, res) => {
  try {
    const { orgId, id: userId } = req.user;
    const { body } = req.body;

    if (!body || typeof body !== 'string' || body.trim().length === 0) {
      return res.status(400).json({ success: false, data: null, error: 'Comment body is required' });
    }

    const task = await Task.findOne({ _id: req.params.id, orgId })
      .populate('createdBy', 'name email');
    if (!task) {
      return res.status(404).json({ success: false, data: null, error: 'Task not found' });
    }

    const mentionEmails = extractMentionEmails(body);
    const mentionedUsers = mentionEmails.length
      ? await User.find({ orgId, email: { $in: mentionEmails } }).select('_id name email')
      : [];
    const mentionedUserIds = mentionedUsers.map(u => u._id);

    const activity = await TaskActivity.create({
      orgId,
      taskId: task._id,
      type: 'comment',
      actorId: userId,
      comment: {
        body: body.trim(),
        mentions: mentionedUserIds,
      },
    });

    await logAudit({
      orgId,
      userId,
      action: 'create',
      resource: 'task_comment',
      resourceId: task._id,
      changes: { taskId: task._id, mentions: mentionEmails },
      ipAddress: req.ip,
    });

    for (const mentionedUser of mentionedUsers) {
      await notifyTaskMentioned({ orgId, task, mentionedUserId: mentionedUser._id, mentionedBy: userId });
    }

    const populated = await populateActivity(activity);
    res.status(201).json({ success: true, data: populated, error: null });
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: err.message });
  }
});

router.get('/', checkPermission('read', 'tasks'), async (req, res) => {
  try {
    const { orgId } = req.user;
    const { page = 1, limit = 20, status, priority, assigneeId, search } = req.query;
    const filter = { orgId };
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (assigneeId) filter.assigneeId = assigneeId;
    
    // Add search functionality
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await Task.countDocuments(filter);
    const tasks = await Task.find(filter)
      .populate('assigneeId', 'name email')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({
      success: true,
      data: tasks,
      error: null,
      meta: { page: Number(page), limit: Number(limit), total },
    });
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: err.message });
  }
});

router.get('/:id', checkPermission('read', 'tasks'), async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, orgId: req.user.orgId })
      .populate('assigneeId', 'name email')
      .populate('createdBy', 'name email');

    if (!task) {
      return res.status(404).json({ success: false, data: null, error: 'Task not found' });
    }

    res.json({ success: true, data: task, error: null });
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: err.message });
  }
});

router.post('/', checkPermission('create', 'tasks'), async (req, res) => {
  try {
    const { orgId, id: userId } = req.user;
    const { title, description, status, priority, assigneeId, tags, dueDate, isRecurring, recurringFrequency } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, data: null, error: 'Title is required' });
    }

    let nextRecurringDate = null;
    if (isRecurring && recurringFrequency) {
        const now = new Date();
        if (recurringFrequency === 'daily') {
            nextRecurringDate = new Date(now.setDate(now.getDate() + 1));
        } else if (recurringFrequency === 'weekly') {
            nextRecurringDate = new Date(now.setDate(now.getDate() + 7));
        } else if (recurringFrequency === 'monthly') {
            nextRecurringDate = new Date(now.setMonth(now.getMonth() + 1));
        }
    }

    const task = await Task.create({
      orgId,
      title,
      description,
      status,
      priority,
      assigneeId,
      createdBy: userId,
      tags,
      dueDate,
      isRecurring,
      recurringFrequency,
      nextRecurringDate,
    });

    if (assigneeId) {
      await TaskActivity.create({
        orgId,
        taskId: task._id,
        type: 'assigned',
        actorId: userId,
        fromAssigneeId: null,
        toAssigneeId: assigneeId,
      });
    }

    await logAudit({
      orgId,
      userId,
      action: 'create',
      resource: 'task',
      resourceId: task._id,
      changes: { title, status: task.status, priority: task.priority },
      ipAddress: req.ip,
    });

    if (assigneeId) {
      await notifyTaskAssigned({ orgId, task, assigneeId, assignedBy: userId });
    }

    res.status(201).json({ success: true, data: task, error: null });
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: err.message });
  }
});

router.put('/:id', checkPermission('update', 'tasks'), async (req, res) => {
  try {
    const { orgId, id: userId } = req.user;
    const updates = req.body;

    const task = await Task.findOne({ _id: req.params.id, orgId });
    if (!task) {
      return res.status(404).json({ success: false, data: null, error: 'Task not found' });
    }

    const oldValues = { status: task.status, priority: task.priority, title: task.title, assigneeId: task.assigneeId };
    const oldAssigneeId = task.assigneeId ? String(task.assigneeId) : null;
    const oldStatus = task.status;

    if (updates.status === 'done' && task.status !== 'done') {
      updates.completedAt = new Date();
    }

    Object.assign(task, updates);
    await task.save();

    const activityToInsert = [];
    if (updates.status && updates.status !== oldStatus) {
      activityToInsert.push({
        orgId,
        taskId: task._id,
        type: 'status_changed',
        actorId: userId,
        oldStatus,
        newStatus: updates.status,
      });
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'assigneeId')) {
      const newAssigneeId = updates.assigneeId ? String(updates.assigneeId) : null;
      if (newAssigneeId !== oldAssigneeId) {
        activityToInsert.push({
          orgId,
          taskId: task._id,
          type: newAssigneeId ? 'assigned' : 'unassigned',
          actorId: userId,
          fromAssigneeId: oldAssigneeId,
          toAssigneeId: newAssigneeId,
        });
      }
    }

    if (activityToInsert.length) {
      await TaskActivity.insertMany(activityToInsert);
    }

    await logAudit({
      orgId,
      userId,
      action: 'update',
      resource: 'task',
      resourceId: task._id,
      changes: { before: oldValues, after: updates },
      ipAddress: req.ip,
    });

    if (updates.assigneeId && String(updates.assigneeId) !== oldAssigneeId) {
      await notifyTaskAssigned({ orgId, task, assigneeId: updates.assigneeId, assignedBy: userId });
    }

    if (updates.status && updates.status !== oldStatus) {
      await notifyTaskStatusChanged({ orgId, task, oldStatus, newStatus: updates.status, changedBy: userId });
    }

    res.json({ success: true, data: task, error: null });
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: err.message });
  }
});

router.delete('/:id', checkPermission('delete', 'tasks'), async (req, res) => {
  try {
    const { orgId, id: userId } = req.user;
    const task = await Task.findOne({ _id: req.params.id, orgId });

    if (!task) {
      return res.status(404).json({ success: false, data: null, error: 'Task not found' });
    }

    await Task.deleteOne({ _id: task._id });

    await logAudit({
      orgId,
      userId,
      action: 'delete',
      resource: 'task',
      resourceId: task._id,
      changes: { title: task.title },
      ipAddress: req.ip,
    });

    res.json({ success: true, data: { message: 'Task deleted' }, error: null });
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: err.message });
  }
});

module.exports = router;
