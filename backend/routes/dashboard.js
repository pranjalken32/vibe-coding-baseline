const express = require('express');
const Task = require('../models/Task');
const authMiddleware = require('../middleware/auth');

const router = express.Router({ mergeParams: true });

router.use(authMiddleware);

router.get('/summary', async (req, res) => {
  try {
    const baseFilter = { orgId: req.user.orgId };

    if (req.user.role === 'member') {
      baseFilter.assigneeId = req.user._id;
    }

    const [statusCounts, priorityCounts, totalTasks, overdueTasks] = await Promise.all([
      Task.aggregate([
        { $match: baseFilter },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Task.aggregate([
        { $match: baseFilter },
        { $group: { _id: '$priority', count: { $sum: 1 } } },
      ]),
      Task.countDocuments(baseFilter),
      Task.countDocuments({ ...baseFilter, dueDate: { $lt: new Date() }, status: { $ne: 'done' } }),
    ]);

    const byStatus = {};
    statusCounts.forEach(s => { byStatus[s._id] = s.count; });

    const byPriority = {};
    priorityCounts.forEach(p => { byPriority[p._id] = p.count; });

    res.json({
      success: true,
      data: {
        totalTasks,
        overdueTasks,
        byStatus,
        byPriority,
        completionRate: totalTasks > 0
          ? Math.round(((byStatus['done'] || 0) / totalTasks) * 100)
          : 0,
      },
      error: null,
    });
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: err.message });
  }
});

module.exports = router;
