const mongoose = require('mongoose');

const FeedbackSchema = new mongoose.Schema({
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student'
    },
    studentName: {
        type: String,
        required: true
    },
    feedbackText: {
        type: String,
        required: [true, 'Feedback text cannot be empty.']
    },
    isRead: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Feedback', FeedbackSchema);