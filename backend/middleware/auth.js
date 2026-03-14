const jwt = require('jsonwebtoken');

// Verify JWT token
const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'No token provided. Access denied.' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Invalid or expired token.' });
    }
};

// Role-based guards
const requireRole = (...roles) => (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
        return res.status(403).json({ message: 'Forbidden. Insufficient permissions.' });
    }
    next();
};

const requireAdmin = requireRole('super_admin');
const requireOwner = requireRole('owner', 'super_admin');
const requireUser = requireRole('user', 'owner', 'super_admin');

const requireSubscription = async (req, res, next) => {
    if (req.user.role === 'super_admin') return next();
    if (req.user.role !== 'owner') return res.status(403).json({ message: 'Only owners need subscriptions' });

    try {
        const db = require('../config/db');
        const [subs] = await db.query(
            "SELECT id FROM owner_subscriptions WHERE owner_id = ? AND status = 'active' AND end_date > NOW() LIMIT 1",
            [req.user.id]
        );
        if (subs.length === 0) {
            return res.status(403).json({ message: 'Active subscription required. Please subscribe to continue.' });
        }
        next();
    } catch (err) {
        res.status(500).json({ message: 'Middleware error' });
    }
};

module.exports = { authenticate, requireRole, requireAdmin, requireOwner, requireUser, requireSubscription };
