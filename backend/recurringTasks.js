const cron = require('node-cron');
const Task = require('./models/Task');
const mongoose = require('mongoose');

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/etmp';
mongoose.connect(MONGODB_URI);


// Schedule a cron job to run every day at midnight
cron.schedule('0 0 * * *', async () => {
  console.log('Running recurring task job...');
  try {
    const recurringTasks = await Task.find({
      isRecurring: true,
      nextRecurringDate: { $lte: new Date() },
    });

    for (const task of recurringTasks) {
      // Create a new task from the recurring one
      const newTask = new Task({
        orgId: task.orgId,
        title: task.title,
        description: task.description,
        priority: task.priority,
        assigneeId: task.assigneeId,
        createdBy: task.createdBy,
        tags: task.tags,
        isRecurring: task.isRecurring,
        recurringFrequency: task.recurringFrequency,
      });

      // Calculate the next recurring date
      const now = new Date();
      let nextRecurringDate;
      if (task.recurringFrequency === 'daily') {
        nextRecurringDate = new Date(now.setDate(now.getDate() + 1));
      } else if (task.recurringFrequency === 'weekly') {
        nextRecurringDate = new Date(now.setDate(now.getDate() + 7));
      } else if (task.recurringFrequency === 'monthly') {
        nextRecurringDate = new Date(now.setMonth(now.getMonth() + 1));
      }
      
      newTask.nextRecurringDate = nextRecurringDate;
      task.nextRecurringDate = nextRecurringDate; // Also update the original task's next recurring date

      await newTask.save();
      await task.save();
      console.log(`Created new task from recurring task: ${task.title}`);
    }
  } catch (error) {
    console.error('Error processing recurring tasks:', error);
  }
});

console.log('Recurring task scheduler started.');
