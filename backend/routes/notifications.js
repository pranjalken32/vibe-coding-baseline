const express = require('express');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const { id: userId } = req.user;
    const { page = 1, limit = 20 } = req.query;

    const total = await Notification.countDocuments({ recipientId: userId });
    const unreadCount = await Notification.countDocuments({ recipientId: userId, read: false });
    const notifications = await Notification.find({ recipientId: userId })
      .populate('triggeredBy', 'name email')
      .populate('taskId', 'title status')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({
      success: true,
      data: notifications,
      error: null,
      meta: { page: Number(page), limit: Number(limit), total, unreadCount },
    });
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: err.message });
  }
});

router.get('/unread-count', async (req, res) => {
  try {
    const { id: userId } = req.user;
    const unreadCount = await Notification.countDocuments({ recipientId: userId, read: false });
    res.json({ success: true, data: { unreadCount }, error: null });
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: err.message });
  }
});

router.put('/:id/read', async (req, res) => {
  try {
    const { id: userId } = req.user;
    const notification = await Notification.findOne({ _id: req.params.id, recipientId: userId });

    if (!notification) {
      return res.status(404).json({ success: false, data: null, error: 'Notification not found' });
    }

    notification.read = true;
    await notification.save();

    res.json({ success: true, data: notification, error: null });
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: err.message });
  }
});

router.put('/read-all', async (req, res) => {
  try {
    const { id: userId } = req.user;
    await Notification.updateMany({ recipientId: userId, read: false }, { read: true });
    res.json({ success: true, data: { message: 'All notifications marked as read' }, error: null });
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: err.message });
  }
});

router.get('/preferences', async (req, res) => {
  try {
    const { id: userId } = req.user;
    const user = await User.findById(userId).select('notificationPrefs');
    res.json({ success: true, data: user.notificationPrefs, error: null });
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: err.message });
  }
});

router.put('/preferences', async (req, res) => {
  try {
    const { id: userId } = req.user;
    const { email, inApp } = req.body;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ success: false, data: null, error: 'User not found' });
    }

    if (typeof email === 'boolean') user.notificationPrefs.email = email;
    if (typeof inApp === 'boolean') user.notificationPrefs.inApp = inApp;
    await user.save();

    res.json({ success: true, data: user.notificationPrefs, error: null });
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: err.message });
  }
});

module.exports = router;
