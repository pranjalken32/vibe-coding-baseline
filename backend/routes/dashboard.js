const express = require('express');
const Task = require('../models/Task');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

router.get('/stats', async (req, res) => {
  try {
    const { orgId } = req.user;

    const [totalTasks, openTasks, inProgressTasks, doneTasks, totalUsers] = await Promise.all([
      Task.countDocuments({ orgId }),
      Task.countDocuments({ orgId, status: 'open' }),
      Task.countDocuments({ orgId, status: 'in_progress' }),
      Task.countDocuments({ orgId, status: 'done' }),
      User.countDocuments({ orgId }),
    ]);

    const overdueTasks = await Task.countDocuments({
      orgId,
      dueDate: { $lt: new Date() },
      status: { $ne: 'done' },
    });

    res.json({
      success: true,
      data: {
        totalTasks,
        openTasks,
        inProgressTasks,
        doneTasks,
        overdueTasks,
        totalUsers,
        completionRate: totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0,
      },
      error: null,
    });
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: err.message });
  }
});

module.exports = router;
