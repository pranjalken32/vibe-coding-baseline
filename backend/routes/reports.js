const express = require('express');
const Task = require('../models/Task');
const { authMiddleware } = require('../middleware/auth');
const { checkPermission } = require('../middleware/rbac');

const router = express.Router();

router.use(authMiddleware);

// Get task distribution by status
router.get('/distribution/status', checkPermission('read', 'tasks'), async (req, res) => {
  try {
    const { orgId } = req.user;
    const distribution = await Task.aggregate([
      { $match: { orgId } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $project: { status: '$_id', count: 1, _id: 0 } },
    ]);
    res.json({ success: true, data: distribution, error: null });
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: err.message });
  }
});

// Get task distribution by priority
router.get('/distribution/priority', checkPermission('read', 'tasks'), async (req, res) => {
  try {
    const { orgId } = req.user;
    const distribution = await Task.aggregate([
      { $match: { orgId } },
      { $group: { _id: '$priority', count: { $sum: 1 } } },
      { $project: { priority: '$_id', count: 1, _id: 0 } },
    ]);
    res.json({ success: true, data: distribution, error: null });
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: err.message });
  }
});

// Get tasks completed over time
router.get('/completed-over-time', checkPermission('read', 'tasks'), async (req, res) => {
  try {
    const { orgId } = req.user;
    const { days = 30 } = req.query;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - Number(days));

    const completedTasks = await Task.aggregate([
      {
        $match: {
          orgId,
          status: 'done',
          updatedAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$updatedAt' },
          },
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          date: '$_id',
          count: 1,
          _id: 0,
        },
      },
      { $sort: { date: 1 } },
    ]);

    res.json({ success: true, data: completedTasks, error: null });
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: err.message });
  }
});

// Export tasks as CSV
router.get('/export/csv', checkPermission('read', 'tasks'), async (req, res) => {
  try {
    const { orgId } = req.user;
    const tasks = await Task.find({ orgId })
      .populate('assigneeId', 'name email')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    // CSV header
    const csvRows = [
      'ID,Title,Description,Status,Priority,Assignee,Created By,Due Date,Created At,Updated At',
    ];

    // CSV data rows
    tasks.forEach(task => {
      const row = [
        task._id,
        `"${(task.title || '').replace(/"/g, '""')}"`,
        `"${(task.description || '').replace(/"/g, '""')}"`,
        task.status,
        task.priority,
        task.assigneeId ? `"${task.assigneeId.name}"` : '',
        task.createdBy ? `"${task.createdBy.name}"` : '',
        task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '',
        new Date(task.createdAt).toISOString(),
        new Date(task.updatedAt).toISOString(),
      ];
      csvRows.push(row.join(','));
    });

    const csv = csvRows.join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="tasks-export-${Date.now()}.csv"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: err.message });
  }
});

module.exports = router;
