const express = require('express');
const router = express.Router();
const Project = require('../models/Project');
const auth = require('../middleware/authMiddleware');

// 1. GET: List ALL projects for a user (Metadata only)
router.get('/list', auth, async (req, res) => {
    try {
        // We only send back the title and date to make the menu load instantly
        const projects = await Project.find({ userId: req.user.id })
                                      .select('title updatedAt')
                                      .sort({ updatedAt: -1 }); 
        res.json(projects);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching projects list' });
    }
});

// 2. GET: Load a specific project's full data
router.get('/:id', auth, async (req, res) => {
    try {
        const project = await Project.findOne({ _id: req.params.id, userId: req.user.id });
        if (!project) return res.status(404).json({ message: 'Project not found' });
        res.json(project);
    } catch (err) {
        res.status(500).json({ message: 'Error loading project data' });
    }
});

// 3. POST: Create a BRAND NEW project
router.post('/', auth, async (req, res) => {
    try {
        const { title, blocks } = req.body;
        const project = new Project({
            userId: req.user.id,
            title: title || 'Untitled Mix',
            blocks: blocks
        });
        await project.save();
        res.json({ message: 'Project created successfully!', project });
    } catch (err) {
        res.status(500).json({ message: 'Server Error while creating project' });
    }
});

// 4. PUT: Update an EXISTING project
router.put('/:id', auth, async (req, res) => {
    try {
        const { title, blocks } = req.body;
        let project = await Project.findOne({ _id: req.params.id, userId: req.user.id });
        if (!project) return res.status(404).json({ message: 'Project not found' });

        if (title) project.title = title;
        project.blocks = blocks;
        project.updatedAt = Date.now();
        await project.save();

        res.json({ message: 'Project updated successfully!', project });
    } catch (err) {
        res.status(500).json({ message: 'Server Error while updating project' });
    }
});

// 5. DELETE: Remove a project
router.delete('/:id', auth, async (req, res) => {
    try {
        await Project.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
        res.json({ message: 'Project deleted' });
    } catch (err) {
        res.status(500).json({ message: 'Error deleting project' });
    }
});

module.exports = router;