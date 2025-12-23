const jwt = require('jsonwebtoken');
// Ensure environment variables are loaded for access to JWT_SECRET
require('dotenv').config(); 

module.exports = function(req, res, next) {
    
    // CRITICAL FIX: Read the secret key directly from the environment variables.
    // The server.js code should ensure JWT_SECRET is defined (even with a fallback).
    const JWT_SECRET = process.env.JWT_SECRET;

    // 1. Initialize token variable
    let token;

    // --- Check 1: Standard Authorization: Bearer Header (Preferred) ---
    const authHeader = req.header('Authorization');
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
        // Extract the token part: 'Bearer [token]' -> '[token]'
        token = authHeader.split(' ')[1];
    } 
    
    // --- Check 2: Fallback to the Original 'x-auth-token' Header ---
    if (!token) {
        token = req.header('x-auth-token');
    }

    // 2. Check if a token was found in either header
    if (!token) {
        return res.status(401).json({ msg: 'No token, authorization denied (Missing Bearer or x-auth-token).' });
    }

    // 3. Verify the token
    try {
        // Essential check: If the secret is missing, crash/error immediately
        if (!JWT_SECRET) {
            console.error("ADMIN AUTH ERROR: JWT_SECRET environment variable is not loaded.");
            return res.status(500).json({ msg: 'Server configuration error: JWT Secret is missing.' });
        }
        
        const decoded = jwt.verify(token, JWT_SECRET);

        // Add the admin payload from the token to the request object
        req.admin = decoded.admin;
        next();
    } catch (err) {
        // Log error for debugging purposes
        console.error("Admin JWT Verification Failed:", err.message);
        res.status(401).json({ msg: 'Token is not valid or has expired.' });
    }
};