const express = require('express');
const router = express.Router();
const TaskTemplate = require('../models/TaskTemplate');
const { protect, admin } = require('../middleware/auth');

// @route   GET /api/templates
// @desc    Get all task templates
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const templates = await TaskTemplate.find().populate('assignee', 'name');
    res.json(templates);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST /api/templates
// @desc    Create a task template
// @access  Admin
router.post('/', protect, admin, async (req, res) => {
  const { name, title, description, priority, assignee } = req.body;
  try {
    const newTemplate = new TaskTemplate({
      name,
      title,
      description,
      priority,
      assignee,
      createdBy: req.user.id,
    });

    const template = await newTemplate.save();
    res.json(template);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET /api/templates/:id
// @desc    Get task template by ID
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const template = await TaskTemplate.findById(req.params.id).populate('assignee', 'name');
    if (!template) {
      return res.status(404).json({ msg: 'Template not found' });
    }
    res.json(template);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Template not found' });
    }
    res.status(500).send('Server Error');
  }
});

// @route   PUT /api/templates/:id
// @desc    Update a task template
// @access  Admin
router.put('/:id', protect, admin, async (req, res) => {
  const { name, title, description, priority, assignee } = req.body;

  const templateFields = { name, title, description, priority, assignee };

  try {
    let template = await TaskTemplate.findById(req.params.id);

    if (!template) {
      return res.status(404).json({ msg: 'Template not found' });
    }

    template = await TaskTemplate.findByIdAndUpdate(
      req.params.id,
      { $set: templateFields },
      { new: true }
    );

    res.json(template);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   DELETE /api/templates/:id
// @desc    Delete a task template
// @access  Admin
router.delete('/:id', protect, admin, async (req, res) => {
  try {
    const template = await TaskTemplate.findById(req.params.id);

    if (!template) {
      return res.status(404).json({ msg: 'Template not found' });
    }

    await template.remove();

    res.json({ msg: 'Template removed' });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Template not found' });
    }
    res.status(500).send('Server Error');
  }
});

module.exports = router;
