const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const SubCategorySchema = new Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    imageUrl: {
        type: String,
        required: true // This will be the path to the uploaded image
    },
    date: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('subcategory', SubCategorySchema);