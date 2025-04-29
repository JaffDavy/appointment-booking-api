
import { Schema, model } from 'mongoose';

const providerSchema = new Schema({
    user: {
        type: Schema.Types.ObjectId,
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

export default model('Provider', providerSchema);
