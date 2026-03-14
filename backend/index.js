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
const subscriptionRoutes = require('./routes/subscriptions');
const payoutRoutes = require('./routes/payouts');
const financialRoutes = require('./routes/financials');
const ownerRoutes = require('./routes/owner');
const uploadRoutes = require('./routes/upload');
const path = require('path');
const fs = require('fs');

const app = express();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Middleware
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true }));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/turfs', turfRoutes);
app.use('/api/slots', slotRoutes);
app.use('/api/pricing', pricingRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/booking-links', bookingLinksRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/payouts', payoutRoutes);
app.use('/api/financials', financialRoutes);
app.use('/api/owner', ownerRoutes);
app.use('/api/upload', uploadRoutes);


// Health check
app.get('/', (req, res) => res.json({ message: 'Turf Booking API is running', status: 'ok' }));

// 404
app.use('/*path', (req, res) => res.status(404).json({ message: 'Route not found' }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
