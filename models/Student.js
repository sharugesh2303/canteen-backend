const mongoose = require('mongoose');

const StudentSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: { 
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    // FIX: The registerNumber field is REMOVED entirely from the schema
    // to prevent the "registerNumber: null" duplicate key error.
    favorites: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MenuItem'
    }]
});

module.exports = mongoose.model('Student', StudentSchema);
