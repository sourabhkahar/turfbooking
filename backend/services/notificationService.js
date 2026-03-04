const nodemailer = require('nodemailer');
const db = require('../config/db');

// Transporter configuration - using placeholders
// USER should update these with their actual SMTP details
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.mailtrap.io',
    port: process.env.SMTP_PORT || 2525,
    auth: {
        user: process.env.SMTP_USER || 'placeholder_user',
        pass: process.env.SMTP_PASS || 'placeholder_pass',
    },
});

const sendEmail = async (to, subject, html) => {
    try {
        const info = await transporter.sendMail({
            from: `"Turf Booking" <${process.env.SMTP_FROM || 'noreply@turfbooking.com'}>`,
            to,
            subject,
            html,
        });
        console.log('Message sent: %s', info.messageId);
        return true;
    } catch (err) {
        console.error('Email sending failed:', err);
        return false;
    }
};

const sendBookingConfirmation = async (bookingId) => {
    try {
        const [rows] = await db.query(`
            SELECT b.*, t.name as turf_name, t.location as turf_location, 
                   u.name as user_name, u.email as user_email,
                   o.name as owner_name, o.email as owner_email
            FROM bookings b
            JOIN turfs t ON b.turf_id = t.id
            JOIN users u ON b.user_id = u.id
            JOIN users o ON t.owner_id = o.id
            WHERE b.id = ?
        `, [bookingId]);

        if (rows.length === 0) return;

        const booking = rows[0];
        const dateStr = new Date(booking.booking_date).toLocaleDateString();
        const amountDisplay = `₹${booking.total_amount}`;
        const paidDisplay = `₹${booking.paid_amount}`;
        const balanceDisplay = `₹${booking.remaining_amount}`;

        const htmlTemplate = (recipientName) => `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                <h2>Booking Confirmation</h2>
                <p>Hello ${recipientName},</p>
                <p>A new booking has been confirmed at <strong>${booking.turf_name}</strong>.</p>
                <hr />
                <p><strong>Booking ID:</strong> #${booking.id}</p>
                <p><strong>Turf:</strong> ${booking.turf_name}</p>
                <p><strong>Date:</strong> ${dateStr}</p>
                <p><strong>Time:</strong> ${booking.start_time} - ${booking.end_time}</p>
                <p><strong>Total Amount:</strong> ${amountDisplay}</p>
                <p><strong>Amount Paid:</strong> ${paidDisplay}</p>
                <p><strong>Balance Due:</strong> ${balanceDisplay}</p>
                <hr />
                <p>Thank you for using our Turf Booking system!</p>
            </div>
        `;

        // Send to user
        await sendEmail(
            booking.user_email,
            `Booking Confirmed! - ${booking.turf_name}`,
            htmlTemplate(booking.user_name)
        );

        // Send to owner
        await sendEmail(
            booking.owner_email,
            `New Booking Received! - ${booking.turf_name}`,
            htmlTemplate(booking.owner_name)
        );

    } catch (err) {
        console.error('Error in sendBookingConfirmation:', err);
    }
};

module.exports = {
    sendBookingConfirmation
};
