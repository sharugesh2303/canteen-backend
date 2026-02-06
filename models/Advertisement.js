/* ======================================================
 * FILE: models/Advertisement.js
 * ====================================================== */

const mongoose = require('mongoose');

const AdvertisementSchema = new mongoose.Schema({
    // URL of the image (Cloudinary or local path)
    imageUrl: {
        type: String,
        required: true,
    },

    // 🟢 LOCATION SPLIT: Identifies where the ad should be displayed
    location: {
        type: String,
        enum: ['canteen', 'cafeteria'],
        default: 'canteen',
        required: true,
        // Optional: trim whitespace to prevent matching errors
        trim: true,
        lowercase: true 
    },

    // Status to enable/disable ads without deleting them
    isActive: {
        type: Boolean,
        default: true,
    },

    // Timestamp for tracking and sorting (Newest first)
    uploadedAt: {
        type: Date,
        default: Date.now,
    },
});

/* ======================================================
    INDEXING (Performance Optimization)
    Helps the backend filter ads by location quickly 
    when the Student App or Admin Panel requests them.
====================================================== */
AdvertisementSchema.index({ location: 1, isActive: -1 });

module.exports = mongoose.model('Advertisement', AdvertisementSchema);