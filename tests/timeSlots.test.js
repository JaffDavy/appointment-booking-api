import { expect } from 'chai';
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../app.js';
import TimeSlot from '../models/TimeSlot.js';
import Provider from '../models/Provider.js';
import User from '../models/User.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

describe('TimeSlot Functionality Tests', function () {
    let testProvider;
    let testUser;
    let testTimeSlot;
    let providerToken;
    let userToken;

    // Connect to test database before tests
    before(async function () {
        // Check for existing connection
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGODB_URI);
        }

        // Clear existing data
        await Promise.all([
            TimeSlot.deleteMany({}),
            Provider.deleteMany({}),
            User.deleteMany({})
        ]);

        // Create test users and provider
        const hashedPassword = await bcrypt.hash('testpassword', 10);

        // Create provider user
        const providerUser = await User.create({
            name: 'Test Provider',
            email: 'provider@test.com',
            password: hashedPassword,
            role: 'provider'
        });

        // Create provider
        testProvider = await Provider.create({
            user: providerUser._id,
            services: ['Test Service'],
            availability: [
                {
                    dayOfWeek: 1,
                    startTime: "09:00",
                    endTime: "17:00"
                }
            ]
        });

        // Create regular user
        testUser = await User.create({
            name: 'Test User',
            email: 'user@test.com',
            password: hashedPassword,
            role: 'user'
        });

        // Generate tokens
        providerToken = jwt.sign(
            { userId: providerUser._id, role: 'provider' },
            'schedulesyncsecret',
            { expiresIn: '1h' }
        );

        userToken = jwt.sign(
            { userId: testUser._id, role: 'user' },
            'schedulesyncsecret',
            { expiresIn: '1h' }
        );
    });

    // Clear time slots between tests
    afterEach(async function () {
        await TimeSlot.deleteMany({});
    });

    // Cleanup after all tests
    after(async function () {
        await Promise.all([
            User.deleteMany({}),
            Provider.deleteMany({}),
            TimeSlot.deleteMany({})
        ]);

        // Only disconnect if we established the connection
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
        }
    });

    describe('Time Slot Creation', function () {
        it('should create a time slot successfully with provider authentication', async function () {
            const timeSlotData = {
                startTime: new Date('2023-05-01T10:00:00Z'),
                endTime: new Date('2023-05-01T11:00:00Z')
            };

            const response = await request(app)
                .post('/api/timeslots')
                .set('x-auth-token', providerToken)
                .send(timeSlotData);

            expect(response.status).to.equal(201);
            expect(response.body).to.have.property('provider');
            expect(response.body).to.have.property('startTime');
            expect(response.body).to.have.property('endTime');
            expect(response.body.isBooked).to.equal(false);
        });

        it('should reject time slot creation by a non-provider user', async function () {
            const timeSlotData = {
                startTime: new Date('2023-05-01T10:00:00Z'),
                endTime: new Date('2023-05-01T11:00:00Z')
            };

            const response = await request(app)
                .post('/api/timeslots')
                .set('x-auth-token', userToken)
                .send(timeSlotData);

            expect(response.status).to.equal(403);
            expect(response.body.message).to.equal('Only providers can create time slots');
        });

        it('should validate end time is after start time', async function () {
            const timeSlotData = {
                startTime: new Date('2023-05-01T11:00:00Z'),
                endTime: new Date('2023-05-01T10:00:00Z') // End time before start time
            };

            const response = await request(app)
                .post('/api/timeslots')
                .set('x-auth-token', providerToken)
                .send(timeSlotData);

            expect(response.status).to.equal(400);
            expect(response.body.message).to.equal('End time must be after start time');
        });
    });

    describe('Booking Time Slots', function () {
        beforeEach(async function () {
            // Create a test time slot before each booking test
            testTimeSlot = new TimeSlot({
                provider: testProvider._id,
                startTime: new Date('2023-05-01T10:00:00Z'),
                endTime: new Date('2023-05-01T11:00:00Z'),
                isBooked: false
            });
            await testTimeSlot.save();
        });

        it('should successfully book an available time slot', async function () {
            const response = await request(app)
                .post(`/api/timeslots/${testTimeSlot._id}/book`)
                .set('x-auth-token', userToken);

            expect(response.status).to.equal(200);
            expect(response.body.isBooked).to.equal(true);
            expect(response.body.bookedBy.toString()).to.equal(testUser._id.toString());

            // Verify database was updated
            const updatedSlot = await TimeSlot.findById(testTimeSlot._id);
            expect(updatedSlot.isBooked).to.equal(true);
        });

        it('should reject booking an already booked time slot', async function () {
            // First booking
            await request(app)
                .post(`/api/timeslots/${testTimeSlot._id}/book`)
                .set('x-auth-token', userToken);

            // Create another user to attempt double booking
            const anotherUser = new User({
                name: 'Another User',
                email: 'another@test.com',
                password: 'password',
                role: 'user'
            });
            await anotherUser.save();

            const anotherToken = jwt.sign(
                { userId: anotherUser._id, role: 'user' },
                'schedulesyncsecret',
                { expiresIn: '1h' }
            );

            // Second booking attempt
            const response = await request(app)
                .post(`/api/timeslots/${testTimeSlot._id}/book`)
                .set('x-auth-token', anotherToken);

            expect(response.status).to.equal(400);
            expect(response.body.message).to.equal('Time slot is already booked');
        });

        it('should return 404 when booking a non-existent time slot', async function () {
            const fakeId = new mongoose.Types.ObjectId();

            const response = await request(app)
                .post(`/api/timeslots/${fakeId}/book`)
                .set('x-auth-token', userToken);

            expect(response.status).to.equal(404);
            expect(response.body.message).to.equal('Time slot not found');
        });
    });

    describe('Appointment Cancellation', function () {
        beforeEach(async function () {
            // Create and book a test time slot
            testTimeSlot = new TimeSlot({
                provider: testProvider._id,
                startTime: new Date('2023-05-01T10:00:00Z'),
                endTime: new Date('2023-05-01T11:00:00Z'),
                isBooked: true,
                bookedBy: testUser._id
            });
            await testTimeSlot.save();
        });

        it('should allow a user to cancel their own appointment', async function () {
            const response = await request(app)
                .post(`/api/timeslots/${testTimeSlot._id}/cancel`)
                .set('x-auth-token', userToken);

            expect(response.status).to.equal(200);
            expect(response.body.message).to.equal('Appointment cancelled successfully');

            // Verify database was updated
            const updatedSlot = await TimeSlot.findById(testTimeSlot._id);
            expect(updatedSlot.isBooked).to.equal(false);
            expect(updatedSlot.bookedBy).to.be.null;
        });

        it('should allow a provider to cancel an appointment for their time slot', async function () {
            const response = await request(app)
                .post(`/api/timeslots/${testTimeSlot._id}/cancel`)
                .set('x-auth-token', providerToken);

            expect(response.status).to.equal(200);
            expect(response.body.message).to.equal('Appointment cancelled successfully');

            // Verify database was updated
            const updatedSlot = await TimeSlot.findById(testTimeSlot._id);
            expect(updatedSlot.isBooked).to.equal(false);
            expect(updatedSlot.bookedBy).to.be.null;
        });

        it('should prevent unauthorized users from cancelling appointments', async function () {
            // Create another user who didn't book the appointment
            const anotherUser = new User({
                name: 'Unauthorized User',
                email: 'unauthorized@test.com',
                password: 'password',
                role: 'user'
            });
            await anotherUser.save();

            const unauthorizedToken = jwt.sign(
                { userId: anotherUser._id, role: 'user' },
                'schedulesyncsecret',
                { expiresIn: '1h' }
            );

            const response = await request(app)
                .post(`/api/timeslots/${testTimeSlot._id}/cancel`)
                .set('x-auth-token', unauthorizedToken);

            expect(response.status).to.equal(403);
            expect(response.body.message).to.equal('Not authorized to cancel this appointment');

            // Verify database was NOT updated
            const unchangedSlot = await TimeSlot.findById(testTimeSlot._id);
            expect(unchangedSlot.isBooked).to.equal(true);
        });

        it('should reject cancellation of non-booked time slots', async function () {
            // Create an available (not booked) time slot
            const availableSlot = new TimeSlot({
                provider: testProvider._id,
                startTime: new Date('2023-05-02T10:00:00Z'),
                endTime: new Date('2023-05-02T11:00:00Z'),
                isBooked: false
            });
            await availableSlot.save();

            const response = await request(app)
                .post(`/api/timeslots/${availableSlot._id}/cancel`)
                .set('x-auth-token', providerToken);

            expect(response.status).to.equal(400);
            expect(response.body.message).to.equal('This time slot is not currently booked');
        });
    });

    describe('Integration Tests - API Endpoints', function () {
        it('should allow providers to view all their time slots', async function () {
            // Create multiple time slots for the provider
            await TimeSlot.create([
                {
                    provider: testProvider._id,
                    startTime: new Date('2023-05-01T09:00:00Z'),
                    endTime: new Date('2023-05-01T10:00:00Z')
                },
                {
                    provider: testProvider._id,
                    startTime: new Date('2023-05-01T10:00:00Z'),
                    endTime: new Date('2023-05-01T11:00:00Z')
                },
                {
                    provider: testProvider._id,
                    startTime: new Date('2023-05-01T11:00:00Z'),
                    endTime: new Date('2023-05-01T12:00:00Z')
                }
            ]);

            const response = await request(app)
                .get('/api/timeslots/appointments')
                .set('x-auth-token', providerToken);

            expect(response.status).to.equal(200);
            expect(response.body).to.be.an('array');
            expect(response.body.length).to.equal(3);
        });

        it('should allow users to view only their booked appointments', async function () {
            // Create booked and unbooked time slots
            const slots = await TimeSlot.create([
                {
                    provider: testProvider._id,
                    startTime: new Date('2023-05-01T09:00:00Z'),
                    endTime: new Date('2023-05-01T10:00:00Z'),
                    isBooked: true,
                    bookedBy: testUser._id
                },
                {
                    provider: testProvider._id,
                    startTime: new Date('2023-05-01T10:00:00Z'),
                    endTime: new Date('2023-05-01T11:00:00Z')
                },
                {
                    provider: testProvider._id,
                    startTime: new Date('2023-05-01T11:00:00Z'),
                    endTime: new Date('2023-05-01T12:00:00Z'),
                    isBooked: true,
                    bookedBy: testUser._id
                }
            ]);

            const response = await request(app)
                .get('/api/timeslots/appointments')
                .set('x-auth-token', userToken);

            expect(response.status).to.equal(200);
            expect(response.body).to.be.an('array');
            expect(response.body.length).to.equal(2);

            // Each returned appointment should be booked by this user
            response.body.forEach(appointment => {
                expect(appointment.bookedBy._id).to.equal(testUser._id.toString());
            });
        });

        it('should allow fetching available time slots for a provider', async function () {
            // Create a mix of available and booked slots
            await TimeSlot.create([
                {
                    provider: testProvider._id,
                    startTime: new Date('2050-05-01T09:00:00Z'),  // Future date to avoid filtering by current date
                    endTime: new Date('2050-05-01T10:00:00Z')
                },
                {
                    provider: testProvider._id,
                    startTime: new Date('2050-05-01T10:00:00Z'),
                    endTime: new Date('2050-05-01T11:00:00Z'),
                    isBooked: true,
                    bookedBy: testUser._id
                },
                {
                    provider: testProvider._id,
                    startTime: new Date('2050-05-01T11:00:00Z'),
                    endTime: new Date('2050-05-01T12:00:00Z')
                }
            ]);

            const response = await request(app)
                .get(`/api/timeslots/provider/${testProvider._id}`);

            expect(response.status).to.equal(200);
            expect(response.body).to.be.an('array');
            expect(response.body.length).to.equal(2);  // Only unbooked slots

            // Each returned slot should be available (not booked)
            response.body.forEach(slot => {
                expect(slot.isBooked).to.equal(false);
            });
        });
    });
});
