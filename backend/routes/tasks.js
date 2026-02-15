const express = require('express');
const Task = require('../models/Task');
const { authMiddleware } = require('../middleware/auth');
const { checkPermission } = require('../middleware/rbac');
const { logAudit } = require('../utils/auditHelper');

const router = express.Router();

router.use(authMiddleware);

router.get('/', checkPermission('read', 'tasks'), async (req, res) => {
  try {
    const { orgId } = req.user;
    const { page = 1, limit = 20, status, priority, assigneeId } = req.query;
    const filter = { orgId };
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (assigneeId) filter.assigneeId = assigneeId;

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
    const { title, description, status, priority, assigneeId, tags, dueDate } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, data: null, error: 'Title is required' });
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
    });

    await logAudit({
      orgId,
      userId,
      action: 'create',
      resource: 'task',
      resourceId: task._id,
      changes: { title, status: task.status, priority: task.priority },
      ipAddress: req.ip,
    });

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

    const oldValues = { status: task.status, priority: task.priority, title: task.title };

    if (updates.status === 'done' && task.status !== 'done') {
      updates.completedAt = new Date();
    }

    Object.assign(task, updates);
    await task.save();

    await logAudit({
      orgId,
      userId,
      action: 'update',
      resource: 'task',
      resourceId: task._id,
      changes: { before: oldValues, after: updates },
      ipAddress: req.ip,
    });

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
