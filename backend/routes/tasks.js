const express = require('express');
const Task = require('../models/Task');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');
const { checkPermission } = require('../middleware/rbac');
const { logAudit } = require('../utils/auditHelper');

const router = express.Router({ mergeParams: true });

router.use(authMiddleware);

router.post('/', checkPermission('task.create'), async (req, res) => {
  try {
    const { title, description, status, priority, assigneeId, tags, dueDate } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, data: null, error: 'Title is required' });
    }

    if (assigneeId) {
      if (!['admin', 'manager'].includes(req.user.role)) {
        return res.status(403).json({ success: false, data: null, error: 'Only managers and admins can assign tasks' });
      }
      const assignee = await User.findOne({ _id: assigneeId, orgId: req.user.orgId });
      if (!assignee) {
        return res.status(400).json({ success: false, data: null, error: 'Assignee must be in the same organization' });
      }
    }

    const task = await Task.create({
      orgId: req.user.orgId,
      title,
      description: description || '',
      status: status || 'todo',
      priority: priority || 'medium',
      assigneeId: assigneeId || null,
      createdBy: req.user._id,
      tags: tags || [],
      dueDate: dueDate || null,
    });

    await logAudit({
      orgId: req.user.orgId,
      userId: req.user._id,
      action: 'task.create',
      resource: 'task',
      resourceId: task._id,
      changes: { after: task.toObject() },
      ipAddress: req.ip,
    });

    res.status(201).json({ success: true, data: task, error: null });
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, status, priority, sort } = req.query;
    const filter = { orgId: req.user.orgId };

    if (req.user.role === 'member') {
      filter.assigneeId = req.user._id;
    }

    if (status) filter.status = status;
    if (priority) filter.priority = priority;

    let sortOption = { createdAt: -1 };
    if (sort) {
      const [field, order] = sort.split(':');
      sortOption = { [field]: order === 'asc' ? 1 : -1 };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Task.countDocuments(filter);
    const tasks = await Task.find(filter)
      .sort(sortOption)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('assigneeId', 'name email')
      .populate('createdBy', 'name email');

    res.json({
      success: true,
      data: tasks,
      error: null,
      meta: { page: parseInt(page), limit: parseInt(limit), total },
    });
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: err.message });
  }
});

router.get('/:taskId', async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.taskId, orgId: req.user.orgId })
      .populate('assigneeId', 'name email')
      .populate('createdBy', 'name email');

    if (!task) {
      return res.status(404).json({ success: false, data: null, error: 'Task not found' });
    }

    if (req.user.role === 'member' && task.assigneeId?._id.toString() !== req.user._id.toString() && task.createdBy._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, data: null, error: 'Access denied' });
    }

    res.json({ success: true, data: task, error: null });
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: err.message });
  }
});

router.put('/:taskId', async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.taskId, orgId: req.user.orgId });

    if (!task) {
      return res.status(404).json({ success: false, data: null, error: 'Task not found' });
    }

    const isOwner = task.createdBy.toString() === req.user._id.toString() ||
      (task.assigneeId && task.assigneeId.toString() === req.user._id.toString());

    if (req.user.role === 'member' && !isOwner) {
      return res.status(403).json({ success: false, data: null, error: 'Members can only update their own tasks' });
    }

    const before = task.toObject();
    const { title, description, status, priority, assigneeId, tags, dueDate } = req.body;

    if (assigneeId !== undefined) {
      if (!['admin', 'manager'].includes(req.user.role)) {
        return res.status(403).json({ success: false, data: null, error: 'Only managers and admins can assign tasks' });
      }
      if (assigneeId) {
        const assignee = await User.findOne({ _id: assigneeId, orgId: req.user.orgId });
        if (!assignee) {
          return res.status(400).json({ success: false, data: null, error: 'Assignee must be in the same organization' });
        }
      }
      task.assigneeId = assigneeId;
    }

    if (title !== undefined) task.title = title;
    if (description !== undefined) task.description = description;
    if (status !== undefined) {
      task.status = status;
      if (status === 'done' && !task.completedAt) {
        task.completedAt = new Date();
      } else if (status !== 'done') {
        task.completedAt = null;
      }
    }
    if (priority !== undefined) task.priority = priority;
    if (tags !== undefined) task.tags = tags;
    if (dueDate !== undefined) task.dueDate = dueDate;

    await task.save();

    await logAudit({
      orgId: req.user.orgId,
      userId: req.user._id,
      action: 'task.update',
      resource: 'task',
      resourceId: task._id,
      changes: { before, after: task.toObject() },
      ipAddress: req.ip,
    });

    res.json({ success: true, data: task, error: null });
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: err.message });
  }
});

router.delete('/:taskId', async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.taskId, orgId: req.user.orgId });

    if (!task) {
      return res.status(404).json({ success: false, data: null, error: 'Task not found' });
    }

    const isOwner = task.createdBy.toString() === req.user._id.toString();

    if (req.user.role === 'member' && !isOwner) {
      return res.status(403).json({ success: false, data: null, error: 'Members can only delete their own tasks' });
    }

    if (req.user.role === 'manager' && !isOwner) {
      return res.status(403).json({ success: false, data: null, error: 'Managers can only delete their own tasks' });
    }

    await Task.deleteOne({ _id: task._id });

    await logAudit({
      orgId: req.user.orgId,
      userId: req.user._id,
      action: 'task.delete',
      resource: 'task',
      resourceId: task._id,
      changes: { before: task.toObject() },
      ipAddress: req.ip,
    });

    res.json({ success: true, data: { message: 'Task deleted' }, error: null });
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: err.message });
  }
});

router.put('/:taskId/assign', checkPermission('task.assign'), async (req, res) => {
  try {
    const { assigneeId } = req.body;
    const task = await Task.findOne({ _id: req.params.taskId, orgId: req.user.orgId });

    if (!task) {
      return res.status(404).json({ success: false, data: null, error: 'Task not found' });
    }

    if (assigneeId) {
      const assignee = await User.findOne({ _id: assigneeId, orgId: req.user.orgId });
      if (!assignee) {
        return res.status(400).json({ success: false, data: null, error: 'Assignee must be in the same organization' });
      }
    }

    const before = task.toObject();
    task.assigneeId = assigneeId || null;
    await task.save();

    await logAudit({
      orgId: req.user.orgId,
      userId: req.user._id,
      action: 'task.assign',
      resource: 'task',
      resourceId: task._id,
      changes: { before: { assigneeId: before.assigneeId }, after: { assigneeId: task.assigneeId } },
      ipAddress: req.ip,
    });

    res.json({ success: true, data: task, error: null });
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: err.message });
  }
});

module.exports = router;
