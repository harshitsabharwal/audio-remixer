const mongoose = require('mongoose');

const ProjectSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title:  { type: String, default: 'Untitled Mix' },
    blocks: [
        {
            id: String,
            assetName: String,
            audioUrl: String,      // Path to file in uploads/
            startTime: Number,
            trimStart: Number,
            trimDuration: Number,
            volume: Number,
            speed: Number,
            trackIndex: Number
        }
    ],
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Project', ProjectSchema);