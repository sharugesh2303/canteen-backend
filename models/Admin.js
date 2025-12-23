const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
    // User's email (used for login)
    email: {
        type: String,
        required: true,
        unique: true, // Ensures no two admins share the same email
        lowercase: true, // Stores email in lowercase for consistency
        trim: true,     // Removes leading/trailing whitespace
        index: true     // Creates an index for fast lookups (essential for unique fields)
    },
    // Hashed password
    password: {
        type: String,
        required: true,
        minlength: 6, // Good practice to enforce a minimum length
        select: false // Excludes the password by default when fetching admin documents
    },
    // Role is static for this model but good practice for access control
    role: {
        type: String,
        default: 'admin',
        enum: ['admin'], // Enforces that the only valid role is 'admin'
    },
    // Timestamp for creation and updates
}, { timestamps: true });

const Admin = mongoose.model('Admin', adminSchema);

module.exports = Admin;