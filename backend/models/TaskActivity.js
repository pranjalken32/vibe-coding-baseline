const mongoose = require('mongoose');

const taskActivitySchema = new mongoose.Schema({
  orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true },

  type: {
    type: String,
    enum: ['comment', 'status_changed', 'assigned', 'unassigned'],
    required: true,
  },

  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // For type === 'comment'
  comment: {
    body: { type: String },
    mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },

  // For type === 'status_changed'
  oldStatus: { type: String },
  newStatus: { type: String },

  // For type === 'assigned' | 'unassigned'
  fromAssigneeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  toAssigneeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

taskActivitySchema.index({ orgId: 1, taskId: 1, createdAt: -1 });

module.exports = mongoose.model('TaskActivity', taskActivitySchema);
