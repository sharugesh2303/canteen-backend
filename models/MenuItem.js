const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const MenuItemSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    category: {
        type: String,
        required: true
    },
    subCategory: { // *** NEW FIELD: SubCategory reference ***
        type: Schema.Types.ObjectId,
        ref: 'subcategory', // References the 'subcategory' model
        required: false // Can be optional if not all items have subcategories
    },
    imageUrl: {
        type: String,
        required: true
    },
    stock: { // *** CHANGED: from isAvailable to stock (Number) ***
        type: Number,
        required: true,
        default: 0
    },
    uploadedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('menuItem', MenuItemSchema);