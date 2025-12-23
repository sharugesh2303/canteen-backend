const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;

module.exports = function(req, res, next) {
    // 1. Initialize token variable
    let token;

    // --- Check 1: Student Frontend's Current Header ('x-auth-token') ---
    token = req.header('x-auth-token'); 
    
    // --- Check 2: Standard 'Authorization: Bearer' Header (For future proofing) ---
    if (!token) {
        const authHeader = req.header('Authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
             // Extract the token part: 'Bearer [token]' -> '[token]'
             token = authHeader.split(' ')[1];
        }
    }

    // 2. Final check for token presence
    if (!token) {
        return res.status(401).json({ msg: 'No token, authentication denied.' });
    }

    // 3. Verify the token
    try {
        // The token payload should contain the student object { student: { id: studentId } }
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Add the student payload from the token to the request object
        // NOTE: Ensure your JWT signing uses the 'student' key: jwt.sign( { student: { id: student.id } }, ...)
        req.student = decoded.student; 
        
        next(); // Proceed to the next middleware or route handler
        
    } catch (err) {
        console.error("Student JWT Verification Failed:", err.message);
        res.status(401).json({ msg: 'Token is not valid or has expired.' });
    }
};