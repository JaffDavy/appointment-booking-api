
const mongoose = require('mongoose');

const providerSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    services: [{
        type: String,
        required: true
    }],
    availability: [{
        dayOfWeek: {
            type: Number, // 0-6 for Sunday to Saturday
            required: true
        },
        startTime: {
            type: String, // Format: "HH:MM" in 24 hour format
            required: true
        },
        endTime: {
            type: String, // Format: "HH:MM" in 24 hour format
            required: true
        }
    }],
    location: {
        address: String,
        city: String,
        state: String,
        zipCode: String,
        country: String
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Provider', providerSchema);
