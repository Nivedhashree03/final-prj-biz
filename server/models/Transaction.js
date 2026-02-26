const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    type: {
        type: String,
        required: true,
        enum: ['Expense', 'Income', 'Business', 'Stock', 'Uploaded', 'income'] // Matches frontend types
    },
    amount: {
        type: Number,
        required: true
    },
    gstRate: {
        type: Number,
        default: 0
    },
    gstAmount: {
        type: Number,
        default: 0
    },
    category: {
        type: String,
        required: true
    },
    description: {
        type: String,
        default: ''
    },
    date: {
        type: Date,
        default: Date.now
    },
    location: {
        type: String,
        default: 'General'
    },
    aiAnalysis: {
        type: Object,
        default: null
    },
});

module.exports = mongoose.model('Transaction', transactionSchema);
