require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const authRoutes = require('./routes/auth');
const turfRoutes = require('./routes/turfs');
const slotRoutes = require('./routes/slots');
const pricingRoutes = require('./routes/pricing');
const bookingRoutes = require('./routes/bookings');
const adminRoutes = require('./routes/admin');
const bookingLinksRoutes = require('./routes/bookingLinks');
const paymentRoutes = require('./routes/payment');


const app = express();

// Middleware
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true }));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/turfs', turfRoutes);
app.use('/api/slots', slotRoutes);
app.use('/api/pricing', pricingRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/booking-links', bookingLinksRoutes);
app.use('/api/payment', paymentRoutes);


// Health check
app.get('/', (req, res) => res.json({ message: 'Turf Booking API is running', status: 'ok' }));

// 404
app.use('/*path', (req, res) => res.status(404).json({ message: 'Route not found' }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
