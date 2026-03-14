'use client';
import { useEffect, useState, use, useCallback } from 'react';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import Link from 'next/link';
import Script from 'next/script';


interface LinkDetails {
    token: string;
    turf_name: string;
    location: string;
    city: string;
    date: string;
    start_time: string;
    end_time: string;
    price: string;
    expires_at: string;
}

export default function BookLinkPage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = use(params);
    const { user } = useAuth();
    const router = useRouter();

    const [details, setDetails] = useState<LinkDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [booking, setBooking] = useState(false);

    const fetchDetails = useCallback(async () => {
        try {
            const { data } = await api.get(`/booking-links/${token}`);
            setDetails(data);
        } catch (err: unknown) {
            const error = err as { response?: { data?: { message?: string } } };
            const message = error.response?.data?.message || 'Invalid or expired link';
            setError(message);
            toast.error(message);

        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        fetchDetails();
    }, [fetchDetails]);


    const handleBook = async () => {
        if (!user) {
            toast.error('Please login to continue booking');
            return router.push(`/login?redirect=/book-link/${token}`);
        }

        setBooking(true);
        try {
            // 1. Initialize booking from link
            const { data: bookingData } = await api.post(`/booking-links/${token}/book`);

            // 2. Create Razorpay Order
            const { data: orderData } = await api.post('/payment/create-order', {
                amount: bookingData.amount_to_pay,
                bookingId: bookingData.booking_id
            });

            // 3. Open Razorpay Checkout
            const options = {
                key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_placeholder',
                amount: orderData.amount,
                currency: "INR",
                name: "Turf Booking",
                description: `Special Link Booking for ${details?.turf_name}`,
                order_id: orderData.id,
                handler: async function (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) {
                    try {
                        await api.post('/payment/verify', {
                            ...response,
                            bookingId: bookingData.booking_id
                        });
                        toast.success('🎉 Booking confirmed successfully!');
                        router.push('/customer');
                    } catch (verifyErr: unknown) {
                        toast.error('Payment verification failed. Please contact support.');
                        console.error('Verification error:', verifyErr);
                    }

                },

                prefill: {
                    name: user.name,
                    email: user.email,
                },
                theme: { color: "#22c55e" },
            };

            const rzp = new (window as unknown as { Razorpay: new (o: any) => { open: () => void; on: (e: string, c: any) => void } }).Razorpay({
                ...options,
                modal: {
                    ondismiss: async function () {
                        setBooking(false);
                        try {
                            await api.post('/bookings/rollback', { booking_ids: [bookingData.booking_id] });
                        } catch (e) { console.error('Rollback failed', e); }
                    }
                }
            });
            rzp.on('payment.failed', function (response: { error: { description: string } }) {
                toast.error(response.error.description);
                setBooking(false);
            });

            rzp.open();

        } catch (err: unknown) {
            const error = err as { response?: { data?: { message?: string } } };
            const message = error.response?.data?.message || 'Booking failed';
            toast.error(message);
            if (message === 'Link has expired') {
                setError('Link has expired');
                setDetails(null);
            }
            setBooking(false);
        }

    };


    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
            </div>
        );
    }

    if (error || !details) {
        return (
            <div className="min-h-screen flex items-center justify-center px-4">
                <div className="glass-card p-8 max-w-md w-full text-center">
                    <div className="text-4xl mb-4">❌</div>
                    <h2 className="text-xl font-bold text-white mb-2">Unavailable</h2>
                    <p className="text-red-400 mb-6">{error}</p>
                    <Link href="/" className="btn-primary inline-flex py-3 px-6">
                        Return Home
                    </Link>
                </div>
            </div>
        );
    }

    const totalAmount = parseFloat(details.price);

    return (
        <div className="min-h-screen flex items-center justify-center px-4 py-16">
            <Script src="https://checkout.razorpay.com/v1/checkout.js" />

            <div className="glass-card p-8 w-full max-w-lg animate-fade-in relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 rounded-full blur-3xl"></div>

                <h1 className="text-2xl font-black text-white mb-2">Confirm Booking</h1>
                <p className="text-green-400 font-semibold mb-6">Special Rate Available!</p>

                <div className="space-y-4 mb-8">
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                        <div className="text-sm text-slate-400 mb-1">Turf Details</div>
                        <div className="font-semibold text-white text-lg">{details.turf_name}</div>
                        <div className="text-sm text-slate-300">📍 {details.location}, {details.city}</div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                            <div className="text-sm text-slate-400 mb-1">Date</div>
                            <div className="font-semibold text-white">{new Date(details.date).toLocaleDateString()}</div>
                        </div>
                        <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                            <div className="text-sm text-slate-400 mb-1">Time</div>
                            <div className="font-semibold text-white">{details.start_time.slice(0, 5)} - {details.end_time.slice(0, 5)}</div>
                        </div>
                    </div>

                    <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/30">
                        <div className="flex justify-between items-center">
                            <div className="text-sm text-slate-300">Total Amount</div>
                            <div className="font-bold text-green-400 text-xl">₹{totalAmount.toLocaleString()}</div>
                        </div>
                    </div>
                </div>

                {!user && (
                    <div className="mb-6 p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-300 text-sm flex gap-3">
                        <span>ℹ️</span>
                        <p>You need to be logged in to confirm this booking. You will be redirected back here after signing in.</p>
                    </div>
                )}

                <button
                    onClick={handleBook}
                    disabled={booking}
                    className="btn-primary w-full justify-center py-4 text-lg"
                >
                    {booking ? 'Processing...' : user ? 'Confirm & Book Now' : 'Login to Book'}
                </button>
            </div>
        </div>
    );
}
