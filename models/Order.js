const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
    billNumber: { type: String, required: true, unique: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    studentName: { type: String, required: true },
    items: [{
        _id: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem' },
        name: String,
        price: Number,
        quantity: Number,
    }],
    totalAmount: { type: Number, required: true },
    paymentMethod: { type: String, required: true, enum: ['UPI', 'Cash on Delivery'] },
    status: {
        type: String,
        // Add 'Ready' to this list
        enum: ['Pending', 'Paid', 'Ready', 'Delivered'], 
        default: 'Pending',
    },
    orderDate: { type: Date, default: Date.now },
    deliveredAt: { type: Date },
    razorpayPaymentId: { type: String },
});

module.exports = mongoose.model('Order', OrderSchema);