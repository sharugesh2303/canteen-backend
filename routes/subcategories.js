const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth'); // Or your admin auth middleware
const SubCategory = require('../models/SubCategory');
const upload = require('../middleware/upload'); // Your multer/cloudinary upload middleware

// @route   POST /api/admin/subcategories
// @desc    Create a new subcategory
// @access  Admin
router.post('/', [adminAuth, upload.single('image')], async (req, res) => {
    const { name } = req.body;

    // Check if file was uploaded
    if (!req.file) {
        return res.status(400).json({ msg: 'Please upload an image' });
    }

    try {
        let sub = await SubCategory.findOne({ name });
        if (sub) {
            return res.status(400).json({ msg: 'Subcategory with this name already exists' });
        }

        sub = new SubCategory({
            name,
            imageUrl: req.file.path // This comes from Cloudinary
        });

        await sub.save();
        res.json(sub); // Send back the new subcategory

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET /api/subcategories
// @desc    Get all subcategories (for the form dropdown)
// @access  Public
router.get('/', async (req, res) => {
    try {
        const subcategories = await SubCategory.find().sort({ name: 1 });
        res.json(subcategories); // This returns the array your frontend needs
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;