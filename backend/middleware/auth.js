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

// Owner must have a subscription running now. Attaches req.subscription (plan limits).
const requireSubscription = async (req, res, next) => {
    if (req.user.role === 'super_admin') return next();
    if (req.user.role !== 'owner') return res.status(403).json({ message: 'Only owners need subscriptions' });
    try {
        const { getActiveSubscription } = require('../services/subscriptionService');
        const sub = await getActiveSubscription(req.user.id);
        if (!sub) {
            return res.status(402).json({ code: 'SUBSCRIPTION_REQUIRED', message: 'Active subscription required. Please subscribe or renew to continue.' });
        }
        req.subscription = sub;
        next();
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

// Plan feature gate, used after requireSubscription. e.g. requireFeature('allow_booking_links')
const requireFeature = (flag, label = 'This feature') => (req, res, next) => {
    if (req.user.role === 'super_admin' || req.subscription?.[flag]) return next();
    return res.status(403).json({ code: 'PLAN_UPGRADE_REQUIRED', message: `${label} is available on the Pro plan. Upgrade to use it.` });
};

module.exports = { authenticate, requireRole, requireAdmin, requireOwner, requireUser, requireSubscription, requireFeature };
