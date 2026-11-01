// Can customers book (and pay for) this turf right now?
const { getActiveSubscription } = require('./subscriptionService');
const { ownerCanReceive } = require('./settlement');

async function bookabilityError(turf, conn) {
    if (!turf) return { status: 404, message: 'Turf not found' };
    if (turf.status !== 'approved') return { status: 409, message: 'This turf is not open for bookings' };
    if (!(await getActiveSubscription(turf.owner_id, conn))) {
        return { status: 409, message: 'This turf is not taking bookings right now' };
    }
    if (!(await ownerCanReceive(turf.owner_id))) {
        return { status: 409, message: 'This turf is not accepting online payments yet. Please contact the venue.' };
    }
    return null;
}

module.exports = { bookabilityError };
