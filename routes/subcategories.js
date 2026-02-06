const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const adminAuth = require('../middleware/adminAuth'); 
const SubCategory = require('../models/SubCategory');
const upload = require('../middleware/upload'); 

// @route    POST /api/admin/subcategories
// @desc     Create a new subcategory (Linked to location)
// @access   Admin
router.post('/', [adminAuth, upload.single('image')], async (req, res) => {
    // ✅ Extract location from body (canteen or cafeteria)
    const { name, location } = req.body;

    if (!req.file) {
        return res.status(400).json({ msg: 'Please upload an image' });
    }

    try {
        const targetLocation = location || "canteen";

        // ✅ Check if subcategory exists IN THAT SPECIFIC LOCATION
        // This allows "Drinks" to exist in both Canteen and Cafeteria separately
        let sub = await SubCategory.findOne({ name, location: targetLocation });
        
        if (sub) {
            return res.status(400).json({ msg: `Subcategory '${name}' already exists in ${targetLocation}` });
        }

        sub = new SubCategory({
            name,
            location: targetLocation, // ✅ Save the location
            imageUrl: req.file.path   // Cloudinary URL
        });

        await sub.save();
        res.json(sub);

    } catch (err) {
        console.error("❌ SUB-CAT CREATE ERROR:", err.message);
        res.status(500).send('Server Error');
    }
});

// @route    GET /api/subcategories
// @desc     Get subcategories based on location
// @access   Public
router.get('/', async (req, res) => {
    try {
        // ✅ Get location from query params: /api/subcategories?location=cafeteria
        const { location } = req.query; 
        
        let query = {};
        if (location === "cafeteria") {
            query.location = "cafeteria";
        } else {
            // ✅ Default logic: explicitly 'canteen' OR legacy data (no location field)
            query = { 
                $or: [
                    { location: "canteen" }, 
                    { location: { $exists: false } }
                ] 
            };
        }

        const subcategories = await SubCategory.find(query).sort({ name: 1 });
        res.json(subcategories); 
    } catch (err) {
        console.error("❌ SUB-CAT FETCH ERROR:", err.message);
        res.status(500).send('Server Error');
    }
});

/* =====================================================
    UPDATE SUBCATEGORY (ADMIN)
===================================================== */
router.put('/:id', [adminAuth, upload.single('image')], async (req, res) => {
    try {
        const { name, location } = req.body;
        const update = { name };
        
        if (location) update.location = location;
        if (req.file) update.imageUrl = req.file.path;

        const sub = await SubCategory.findByIdAndUpdate(
            req.params.id, 
            update, 
            { new: true }
        );
        
        res.json(sub);
    } catch (err) {
        console.error("❌ SUB-CAT UPDATE ERROR:", err.message);
        res.status(500).send('Server Error');
    }
});

/* =====================================================
    DELETE SUBCATEGORY (ADMIN)
===================================================== */
router.delete('/:id', adminAuth, async (req, res) => {
    try {
        await SubCategory.findByIdAndDelete(req.params.id);
        res.json({ msg: 'Subcategory removed' });
    } catch (err) {
        console.error("❌ SUB-CAT DELETE ERROR:", err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;