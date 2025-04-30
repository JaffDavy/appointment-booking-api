
# Schedule Sync API

A RESTful API for appointment scheduling and service provider management.

## Features

- **User Authentication**: Register, login, and manage users with different roles (user, provider, admin)
- **Provider Management**: Service providers can set their availability and services
- **Appointment Booking**: Users can view available time slots and book appointments
- **Real-time Notifications**: WebSocket integration for instant updates when appointments are booked or canceled
- **API Documentation**: Complete Swagger documentation of all endpoints

## Technologies

- **Backend**: Node.js with Express
- **Database**: MongoDB with Mongoose
- **Authentication**: JWT-based authentication
- **Real-time Communication**: Socket.IO
- **API Documentation**: Swagger/OpenAPI
- **Logging**: Winston combined with Morgan
- **Testing**: Mocha and Chai

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- MongoDB (v4 or higher)
- npm or yarn

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/your-username/schedule-sync.git
   cd schedule-sync
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Set up environment variables (optional):
   Create a `.env` file in the root directory with the following variables:
   ```
   PORT=3000
   MONGODB_URI=mongodb://localhost:27017/schedule_sync
   JWT_SECRET=your_secret_key
   NODE_ENV=development
   ```

4. Start the development server:
   ```
   npm run dev
   ```

### Testing the API

The API will be available at `http://localhost:3000`. You can use tools like Thunder Client, Postman, or curl to test the endpoints.

For detailed API documentation, visit `http://localhost:3000/api-docs` after starting the server.

## API Endpoints

### Authentication

- **POST /api/auth/register**: Register a new user
- **POST /api/auth/login**: Log in an existing user
- **GET /api/auth/me**: Get the current user's profile

### Time Slots & Appointments

- **POST /api/timeslots**: Create a new time slot (provider only)
- **GET /api/timeslots/provider/:providerId**: Get a provider's available time slots
- **GET /api/timeslots/appointments**: Get user's appointments or provider's time slots
- **POST /api/timeslots/:timeSlotId/book**: Book an appointment
- **POST /api/timeslots/:timeSlotId/cancel**: Cancel a booked appointment

## Data Models

### User

- **name**: String (required)
- **email**: String (required, unique)
- **password**: String (required, hashed)
- **role**: String (enum: 'user', 'provider', 'admin', default: 'user')

### Provider

- **user**: Reference to User model
- **services**: Array of strings
- **availability**: Array of available time ranges by day of week
- **location**: Object with address details

### TimeSlot

- **provider**: Reference to Provider model
- **startTime**: Date (required)
- **endTime**: Date (required)
- **isBooked**: Boolean (default: false)
- **bookedBy**: Reference to User model (default: null)

## WebSocket Events

Connect to the Socket.IO server to receive real-time notifications:

```javascript
const socket = io('http://localhost:3000');

// Join room for user-specific notifications
socket.emit('join', `user_${userId}`);

// Listen for notifications
socket.on('notification', (data) => {
  console.log('Notification:', data);
  // Handle different notification types
  switch(data.type) {
    case 'APPOINTMENT_BOOKED':
      // Handle new booking
      break;
    case 'APPOINTMENT_CANCELLED_BY_USER':
      // Handle cancellation by user
      break;
    case 'APPOINTMENT_CANCELLED_BY_PROVIDER':
      // Handle cancellation by provider
      break;
  }
});
```

## Testing

Run the test suite with:

```
npm test
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- This project was created as a demonstration of a full-featured scheduling API.