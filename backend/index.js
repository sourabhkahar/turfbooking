require('dotenv').config();
require('./config/env').validateEnv();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const webhookRoutes = require('./routes/webhooks');

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
app.set('trust proxy', 1); // correct client IPs behind Nginx / a load balancer (rate limiting)
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } })); // uploads are shown on the frontend origin
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Webhooks need the raw body for signature checks — mount before the JSON parser
app.use('/api/webhooks', webhookRoutes);

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// Rate limits: strict on login/register, moderate on payments, general cap on the API
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false, message: { message: 'Too many attempts, try again later' } });
const paymentLimiter = rateLimit({ windowMs: 60 * 1000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false });
const apiLimiter = rateLimit({ windowMs: 60 * 1000, limit: 300, standardHeaders: 'draft-7', legacyHeaders: false });
app.use('/api', apiLimiter);
app.use(['/api/auth/login', '/api/auth/register'], authLimiter);
app.use(['/api/payment', '/api/subscriptions'], paymentLimiter);
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

// Central error handler — never leak stack traces to clients
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    console.error(err);
    if (err.type === 'entity.too.large') return res.status(413).json({ message: 'Request too large' });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ message: 'Invalid JSON' });
    res.status(err.status || 500).json({ message: err.status && err.status < 500 ? err.message : 'Server error' });
});

process.on('unhandledRejection', (reason) => console.error('Unhandled rejection:', reason));

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

// Graceful shutdown: finish in-flight requests before exiting
function shutdown(signal) {
    console.log(`\n${signal} received — shutting down gracefully`);
    server.close(() => {
        console.log('✅ HTTP server closed');
        // Release DB pool connections
        const pool = require('./config/db');
        pool.end().then(() => {
            console.log('✅ MySQL pool closed');
            process.exit(0);
        }).catch(() => process.exit(0));
    });
    // Force exit after 10 s if requests are stuck
    setTimeout(() => {
        console.error('⚠️  Forcing exit after timeout');
        process.exit(1);
    }, 10_000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
