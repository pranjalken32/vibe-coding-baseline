const jwt = require('jsonwebtoken');
const User = require('../models/User');

async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, data: null, error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.userId).select('-passwordHash');
    if (!user) {
      return res.status(401).json({ success: false, data: null, error: 'User not found' });
    }

    req.user = {
      _id: user._id,
      orgId: user.orgId,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    next();
  } catch (err) {
    return res.status(401).json({ success: false, data: null, error: 'Invalid token' });
  }
}

module.exports = authMiddleware;
