const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const auth = require('../middleware/authMiddleware');

// Configure Multer storage engine
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Files will be saved in the backend/uploads directory
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        // Create a unique filename: timestamp + original extension
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

// Filter to ensure only audio files are uploaded
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) {
        cb(null, true);
    } else {
        cb(new Error('Not an audio file! Please upload a WAV, MP3, or OGG.'), false);
    }
};

const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB file size limit
});

// POST: /api/upload
router.post('/', auth, upload.single('audio'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No audio file uploaded' });
        }

        // Create the public URL for the frontend to access the file
        // e.g., http://localhost:5000/uploads/169012345-kick.wav
        const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;

        res.json({ 
            message: 'File uploaded successfully', 
            url: fileUrl,
            filename: req.file.filename
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error during file upload' });
    }
});

module.exports = router;