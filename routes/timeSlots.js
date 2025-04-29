
import express from 'express';
import TimeSlot from '../models/TimeSlot.js';
import Provider from '../models/Provider.js';
import User from '../models/User.js';
import auth from '../middlewares/auth.js'
import { winstonLogger } from '../config/logger.js';
import { sendNotification, getUserRoom, getProviderRoom } from '../services/socketService.js';

const router = express.Router();

/**
 * @swagger
 * /api/timeslots:
 *   post:
 *     summary: Create a new time slot (Provider only)
 *     description: Creates a new availability time slot for a service provider
 *     tags: [TimeSlots]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               startTime:
 *                 type: string
 *                 format: date-time
 *                 example: "2024-04-26T10:00:00Z"
 *               endTime:
 *                 type: string
 *                 format: date-time
 *                 example: "2024-04-26T11:00:00Z"
 *     responses:
 *       201:
 *         description: Time slot created successfully
 *       400:
 *         description: Invalid time slot data
 *       403:
 *         description: User is not a provider
 *       500:
 *         description: Server error
 */
router.post('/', auth, async (req, res) => {
    try {
        // Verify the user is a provider
        const provider = await Provider.findOne({ user: req.user.userId });
        if (!provider) {
            return res.status(403).json({ message: 'Only providers can create time slots' });
        }

        const { startTime, endTime } = req.body;

        // Validate time slot
        if (new Date(startTime) >= new Date(endTime)) {
            return res.status(400).json({ message: 'End time must be after start time' });
        }

        // Create new time slot
        const timeSlot = new TimeSlot({
            provider: provider._id,
            startTime,
            endTime
        });

        await timeSlot.save();
        
        // Log the action
        winstonLogger.info(`Provider ${provider._id} created a new time slot: ${timeSlot._id}`);
        
        res.status(201).json(timeSlot);
    } catch (error) {
        winstonLogger.error('Create time slot error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * @swagger
 * /api/timeslots/provider/{providerId}:
 *   get:
 *     summary: Get provider's available time slots
 *     description: Retrieves all available (not booked) time slots for a specific provider
 *     tags: [TimeSlots]
 *     parameters:
 *       - name: providerId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of available time slots
 *       500:
 *         description: Server error
 */
router.get('/provider/:providerId', async (req, res) => {
    try {
        const timeSlots = await TimeSlot.find({
            provider: req.params.providerId,
            isBooked: false,
            startTime: { $gte: new Date() }
        }).sort({ startTime: 1 });

        res.json(timeSlots);
    } catch (error) {
        winstonLogger.error('Get availability error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * @swagger
 * /api/timeslots/appointments:
 *   get:
 *     summary: Get all appointments for the current user
 *     description: Retrieves all appointments for the current user (booked slots for users, all slots for providers)
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of appointments
 *       500:
 *         description: Server error
 */
router.get('/appointments', auth, async (req, res) => {
    try {
        const provider = await Provider.findOne({ user: req.user.userId });
        
        let query;
        if (provider) {
            // If provider, show all their time slots
            query = { provider: provider._id };
        } else {
            // If regular user, show only their booked appointments
            query = { bookedBy: req.user.userId };
        }

        const appointments = await TimeSlot.find(query)
            .populate('provider')
            .populate('bookedBy', '-password')
            .sort({ startTime: 1 });

        res.json(appointments);
    } catch (error) {
        winstonLogger.error('Get appointments error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * @swagger
 * /api/timeslots/{timeSlotId}/book:
 *   post:
 *     summary: Book an appointment
 *     description: Books an available time slot for the current user
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: timeSlotId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Appointment booked successfully
 *       400:
 *         description: Time slot is already booked
 *       404:
 *         description: Time slot not found
 *       500:
 *         description: Server error
 */
router.post('/:timeSlotId/book', auth, async (req, res) => {
    try {
        const timeSlot = await TimeSlot.findById(req.params.timeSlotId);
        
        if (!timeSlot) {
            return res.status(404).json({ message: 'Time slot not found' });
        }

        if (timeSlot.isBooked) {
            return res.status(400).json({ message: 'Time slot is already booked' });
        }

        // Book the appointment
        timeSlot.isBooked = true;
        timeSlot.bookedBy = req.user.userId;
        await timeSlot.save();
        
        // Send notification to the provider
        sendNotification(
            getProviderRoom(timeSlot.provider.toString()), 
            'APPOINTMENT_BOOKED',
            { timeSlot, userId: req.user.userId }
        );
        
        // Log the booking
        winstonLogger.info(`User ${req.user.userId} booked appointment: ${timeSlot._id}`);

        res.json(timeSlot);
    } catch (error) {
        winstonLogger.error('Book appointment error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * @swagger
 * /api/timeslots/{timeSlotId}/cancel:
 *   post:
 *     summary: Cancel an appointment
 *     description: Cancels a booked appointment (can be done by the user who booked it or the provider)
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: timeSlotId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Appointment cancelled successfully
 *       400:
 *         description: Time slot is not booked
 *       403:
 *         description: Not authorized to cancel this appointment
 *       404:
 *         description: Appointment not found
 *       500:
 *         description: Server error
 */
router.post('/:timeSlotId/cancel', auth, async (req, res) => {
    try {
        const timeSlot = await TimeSlot.findById(req.params.timeSlotId)
            .populate('provider', 'user')
            .populate('bookedBy', 'name email');
        
        if (!timeSlot) {
            return res.status(404).json({ message: 'Appointment not found' });
        }

        if (!timeSlot.isBooked) {
            return res.status(400).json({ message: 'This time slot is not currently booked' });
        }

        // Check if user is authorized to cancel (either the booker or the provider)
        const provider = await Provider.findOne({ user: req.user.userId });
        const isProvider = provider && provider._id.toString() === timeSlot.provider._id.toString();
        const isBooker = timeSlot.bookedBy && timeSlot.bookedBy._id.toString() === req.user.userId;

        if (!isProvider && !isBooker) {
            return res.status(403).json({ message: 'Not authorized to cancel this appointment' });
        }

        // Store data for notifications before resetting
        const bookedByUserId = timeSlot.bookedBy._id.toString();
        const providerUserId = timeSlot.provider.user.toString();
        
        // Reset the time slot to be available again
        timeSlot.isBooked = false;
        timeSlot.bookedBy = null;
        await timeSlot.save();
        
        // Send notifications about cancellation
        if (isProvider) {
            // Provider cancelled - notify user
            sendNotification(
                getUserRoom(bookedByUserId),
                'APPOINTMENT_CANCELLED_BY_PROVIDER',
                { timeSlot }
            );
            winstonLogger.info(`Provider ${provider._id} cancelled appointment: ${timeSlot._id}`);
        } else {
            // User cancelled - notify provider
            sendNotification(
                getProviderRoom(timeSlot.provider._id.toString()),
                'APPOINTMENT_CANCELLED_BY_USER',
                { timeSlot }
            );
            winstonLogger.info(`User ${req.user.userId} cancelled appointment: ${timeSlot._id}`);
        }

        res.json({ message: 'Appointment cancelled successfully', timeSlot });
    } catch (error) {
        winstonLogger.error('Cancel appointment error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

export default router;