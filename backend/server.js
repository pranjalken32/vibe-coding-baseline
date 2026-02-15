require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const taskRoutes = require('./routes/tasks');
const dashboardRoutes = require('./routes/dashboard');
const auditLogRoutes = require('./routes/auditLogs');
const userRoutes = require('./routes/users');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/orgs/:orgId/tasks', taskRoutes);
app.use('/api/v1/orgs/:orgId/dashboard', dashboardRoutes);
app.use('/api/v1/orgs/:orgId/audit-logs', auditLogRoutes);
app.use('/api/v1/orgs/:orgId/users', userRoutes);

app.get('/api/v1/health', (req, res) => {
  res.json({ success: true, data: { status: 'ok' }, error: null });
});

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/etmp';

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });

module.exports = app;
