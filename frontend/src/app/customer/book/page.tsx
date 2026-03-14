'use client';
import { useEffect, useState, Suspense, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import Script from 'next/script';
import MediaGallery from '@/components/MediaGallery';


interface MediaItem { url: string; type: 'image' | 'video'; }
interface Turf { id: number; name: string; location: string; city: string; sport_type: string; owner_name: string; part_payment_percentage?: number; images: MediaItem[]; }

interface Slot { id: number; start_time: string; end_time: string; status: string; price_per_hour: number; }

interface RazorpayResponse { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string; }

function BookPage() {
    const { user } = useAuth();
    const router = useRouter();
    const params = useSearchParams();
    const turfId = params.get('turf_id');

    const [turf, setTurf] = useState<Turf | null>(null);
    const [slots, setSlots] = useState<Slot[]>([]);
    const [selectedSlots, setSelectedSlots] = useState<Slot[]>([]);
    const [date, setDate] = useState(new Date().toLocaleDateString('en-CA'));
    const [loading, setLoading] = useState(false);
    const [booking, setBooking] = useState(false);
    const [notes, setNotes] = useState('');
    const [paymentType, setPaymentType] = useState<'full' | 'part'>('full');


    useEffect(() => {
        if (!turfId) return;
        api.get(`/turfs/${turfId}`).then(r => setTurf(r.data)).catch(() => toast.error('Turf not found'));
    }, [turfId]);

    const fetchSlots = useCallback(async () => {
        if (!turfId) return;
        setLoading(true);
        setSelectedSlots([]);
        try {
            const { data } = await api.get(`/slots?turf_id=${turfId}&date=${date}`);
            setSlots(data);
        } catch { toast.error('Failed to load slots'); } finally { setLoading(false); }
    }, [turfId, date]);

    useEffect(() => { if (turfId) fetchSlots(); }, [date, turfId, fetchSlots]);

    const calcDuration = (slot: Slot) => {
        const [sh, sm] = slot.start_time.split(':').map(Number);
        const [eh, em] = slot.end_time.split(':').map(Number);
        return ((eh * 60 + em) - (sh * 60 + sm)) / 60;
    };

    const confirmBooking = async () => {
        if (!user) return router.push('/login');
        if (selectedSlots.length === 0) return toast.error('Select at least one slot');
        setBooking(true);

        try {
            // 1. Initialize booking
            const { data: bookingData } = await api.post('/bookings', {
                slot_ids: selectedSlots.map(s => s.id),
                notes,
                payment_type: paymentType
            });

            // 2. Create Razorpay Order
            const { data: orderData } = await api.post('/payment/create-order', {
                amount: bookingData.amount_to_pay,
                bookingIds: bookingData.booking_ids
            });

            // 3. Open Razorpay Checkout
            const options = {
                key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_placeholder',
                amount: orderData.amount,
                currency: "INR",
                name: "Turf Booking",
                description: `Booking ${selectedSlots.length} slots at ${turf?.name}`,
                order_id: orderData.id,
                handler: async function (response: RazorpayResponse) {
                    try {
                        await api.post('/payment/verify', {
                            ...response,
                            bookingIds: bookingData.booking_ids
                        });
                        toast.success(`🎉 ${selectedSlots.length} slot(s) confirmed successfully!`);
                        router.push('/customer');
                    } catch {
                        toast.error('Payment verification failed. Please contact support.');
                        setBooking(false);
                    }
                },
                prefill: {
                    name: user.name,
                    email: user.email,
                },
                theme: { color: "#22c55e" },
                modal: {
                    ondismiss: async function () {
                        setBooking(false);
                        try {
                            console.log(bookingData.booking_ids);
                            await api.post('/bookings/rollback', { booking_ids: bookingData.booking_ids });
                            fetchSlots(); // Refresh UI
                        } catch (e) { console.error('Rollback failed', e); }
                    }
                }
            };

            const rzp = new (window as unknown as { Razorpay: any }).Razorpay(options);
            rzp.on('payment.failed', function (response: { error: { description: string } }) {
                toast.error(response.error.description);
                setBooking(false);
            });
            rzp.on('modal.closed', function() {
                setBooking(false);
            });
            rzp.open();

        } catch (err: unknown) {
            const message = err && typeof err === 'object' && 'response' in err
                ? (err.response as { data: { message: string } })?.data?.message
                : 'Booking failed';
            toast.error(message);
            setBooking(false);
        }
    };

    const totalDuration = selectedSlots.reduce((acc, s) => acc + calcDuration(s), 0);
    const totalPrice = selectedSlots.reduce((acc, s) => acc + (calcDuration(s) * s.price_per_hour), 0);
    const amountToPay = paymentType === 'part' && turf?.part_payment_percentage
        ? (totalPrice * turf.part_payment_percentage) / 100
        : totalPrice;

    const toggleSlotSelection = (slot: Slot) => {
        if (slot.status !== 'available') return;
        setSelectedSlots(prev =>
            prev.find(s => s.id === slot.id)
                ? prev.filter(s => s.id !== slot.id)
                : [...prev, slot]
        );
    };


    return (
        <div className="max-w-6xl mx-auto px-4 py-10">
            <Script src="https://checkout.razorpay.com/v1/checkout.js" />

            {/* Turf header */}
            {turf && (
                <div className="glass-card p-6 mb-8 animate-fade-in">
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                        <div>
                            <span className="text-xs font-semibold text-green-400 bg-green-400/10 px-2 py-1 rounded-full mb-2 inline-block">{turf.sport_type}</span>
                            <h1 className="text-3xl font-black text-white">{turf.name}</h1>
                            <p className="text-slate-400 mt-1">📍 {turf.location}, {turf.city} &nbsp;·&nbsp; 👤 {turf.owner_name}</p>
                        </div>
                        <div className="text-right">
                            <label className="block text-sm text-slate-400 mb-2">Select Date</label>
                            <input type="date" className="input-field" value={date}
                                disabled={booking}
                                 min={new Date().toLocaleDateString('en-CA')}
                                onChange={e => setDate(e.target.value)} />
                        </div>
                    </div>
                </div>
            )}

            {/* Gallery Section */}
            {turf?.images && turf.images.length > 0 && (
                <div className="mb-10 animate-fade-in" style={{ animationDelay: '100ms' }}>
                    <MediaGallery media={turf.images} />
                </div>
            )}

            <div className="grid lg:grid-cols-3 gap-8">
                {/* Slots */}
                <div className="lg:col-span-2">
                    <h2 className="text-xl font-bold text-white mb-4">Available Slots — {date}</h2>
                    {loading ? (
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                            {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-20 rounded-xl bg-white/5 animate-pulse" />)}
                        </div>
                    ) : slots.length === 0 ? (
                        <div className="glass-card p-10 text-center">
                            <p className="text-slate-400">No slots available for this date. Try another day.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                            {slots.map(slot => {
                                const isSelected = selectedSlots.some(s => s.id === slot.id);
                                const isAvailable = slot.status === 'available';
                                return (
                                    <button key={slot.id}
                                        disabled={!isAvailable || booking}
                                        onClick={() => toggleSlotSelection(slot)}
                                        className={`p-3 rounded-xl text-xs font-semibold text-center transition-all border-2 ${isSelected ? 'slot-selected scale-105 shadow-lg shadow-green-500/20'
                                            : slot.status === 'booked' ? 'slot-booked'
                                                : slot.status === 'blocked' ? 'slot-blocked'
                                                    : 'slot-available hover:scale-105 cursor-pointer'
                                            }`}>
                                        <div className="text-sm font-bold">{slot.start_time.slice(0, 5)}</div>
                                        <div className="text-xs opacity-70 my-1">–</div>
                                        <div className="text-sm font-bold">{slot.end_time.slice(0, 5)}</div>
                                        {isAvailable && slot.price_per_hour > 0 && (
                                            <div className="mt-1 text-xs opacity-80">₹{slot.price_per_hour}/hr</div>
                                        )}
                                        {!isAvailable && <div className="mt-1 capitalize opacity-60">{slot.status}</div>}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* Legend */}
                    <div className="flex gap-5 mt-5 text-xs text-slate-400 flex-wrap">
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded slot-available inline-block"></span> Available (click to select)</span>
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded slot-booked inline-block"></span> Booked</span>
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded slot-blocked inline-block"></span> Blocked</span>
                    </div>
                </div>

                {/* Booking summary */}
                <div>
                    <div className="glass-card p-6 sticky top-24">
                        <h3 className="text-lg font-bold text-white mb-4">Booking Summary</h3>
                        {selectedSlots.length > 0 ? (
                            <div className="space-y-4">
                                <div className="max-h-40 overflow-y-auto space-y-2 mb-4 scrollbar-hide">
                                    {selectedSlots.map(s => (
                                        <div key={s.id} className="p-3 rounded-xl flex justify-between items-center" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
                                            <div>
                                                <div className="font-bold text-white text-sm">{s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)}</div>
                                                <div className="text-[10px] text-slate-400">
                                                    {(() => {
                                                        const [y, m, d] = date.split('-');
                                                        return `${m}/${d}/${y}`;
                                                    })()}
                                                </div>
                                            </div>
                                            <div className="text-xs font-bold text-green-400">₹{calcDuration(s) * s.price_per_hour}</div>
                                        </div>
                                    ))}
                                </div>

                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between text-slate-400">
                                        <span>Total Slots</span>
                                        <span>{selectedSlots.length}</span>
                                    </div>
                                    <div className="flex justify-between text-slate-400">
                                        <span>Total Duration</span>
                                        <span>{totalDuration} hr(s)</span>
                                    </div>
                                    <div className="border-t border-white/10 pt-2 flex justify-between font-bold text-white text-lg">
                                        <span>Total Amount</span>
                                        <span className="text-green-400">₹{totalPrice.toLocaleString()}</span>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-sm text-slate-300 mb-2 block">Notes (optional)</label>
                                    <textarea className="input-field h-20 resize-none text-sm" placeholder="Team size, special requests..."
                                        value={notes} onChange={e => setNotes(e.target.value)} />
                                </div>

                                {turf && turf.part_payment_percentage ? turf.part_payment_percentage > 0 && (
                                    <div className="p-4 rounded-xl border border-white/10 bg-white/5">
                                        <label className="text-sm font-bold text-white mb-3 block">Payment Option</label>
                                        <div className="space-y-2">
                                            <div onClick={() => setPaymentType('full')} className={`p-3 rounded-lg border-2 cursor-pointer transition-all flex justify-between items-center ${paymentType === 'full' ? 'border-green-500 bg-green-500/10' : 'border-white/5 bg-white/5'}`}>
                                                <span className="text-sm">Full Payment</span>
                                                <span className="text-xs font-bold">₹{totalPrice.toLocaleString()}</span>
                                            </div>
                                            <div onClick={() => setPaymentType('part')} className={`p-3 rounded-lg border-2 cursor-pointer transition-all flex justify-between items-center ${paymentType === 'part' ? 'border-green-500 bg-green-500/10' : 'border-white/5 bg-white/5'}`}>
                                                <div>
                                                    <span className="text-sm block">Part Payment ({turf.part_payment_percentage}%)</span>
                                                    <span className="text-[10px] text-slate-400">Rest pay at venue</span>
                                                </div>
                                                <span className="text-xs font-bold text-green-400">₹{amountToPay.toLocaleString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                ) : null}


                                {user ? (
                                    <button onClick={confirmBooking} disabled={booking} className="btn-primary w-full justify-center py-3">
                                        {booking ? 'Confirming...' : '✅ Confirm Booking'}
                                    </button>
                                ) : (
                                    <button onClick={() => router.push('/login')} className="btn-primary w-full justify-center py-3">
                                        Login to Book
                                    </button>
                                )}

                                <p className="text-xs text-slate-500 text-center">* {paymentType === 'full' ? 'Pay full amount online for instant confirmation' : 'Pay advance now, pay the rest in cash at the venue'}</p>

                            </div>
                        ) : (
                            <div className="text-center py-8">
                                <div className="text-4xl mb-3">👆</div>
                                <p className="text-slate-400 text-sm">Select an available slot to see pricing and confirm your booking</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Processing Overlay */}
            {booking && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex flex-col items-center justify-center animate-fade-in">
                    <div className="bg-slate-900 border border-white/10 p-8 rounded-3xl shadow-2xl flex flex-col items-center max-w-xs w-full">
                        <div className="w-16 h-16 border-4 border-green-500/20 border-t-green-500 rounded-full animate-spin mb-6"></div>
                        <h3 className="text-xl font-bold text-white mb-2">Processing...</h3>
                        <p className="text-slate-400 text-center text-sm">Please wait while we confirm your slots and secure your booking.</p>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function CustomerBookPage() {
    return <Suspense><BookPage /></Suspense>;
}
