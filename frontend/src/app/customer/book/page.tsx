'use client';
import { useEffect, useState, Suspense } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface Turf { id: number; name: string; location: string; city: string; sport_type: string; owner_name: string; }
interface Slot { id: number; start_time: string; end_time: string; status: string; price_per_hour: number; }

function BookPage() {
    const { user } = useAuth();
    const router = useRouter();
    const params = useSearchParams();
    const turfId = params.get('turf_id');

    const [turf, setTurf] = useState<Turf | null>(null);
    const [slots, setSlots] = useState<Slot[]>([]);
    const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(false);
    const [booking, setBooking] = useState(false);
    const [notes, setNotes] = useState('');

    useEffect(() => {
        if (!turfId) return;
        api.get(`/turfs/${turfId}`).then(r => setTurf(r.data)).catch(() => toast.error('Turf not found'));
    }, [turfId]);

    const fetchSlots = async () => {
        if (!turfId) return;
        setLoading(true);
        setSelectedSlot(null);
        try {
            const { data } = await api.get(`/slots?turf_id=${turfId}&date=${date}`);
            setSlots(data);
        } catch { toast.error('Failed to load slots'); } finally { setLoading(false); }
    };

    useEffect(() => { if (turfId) fetchSlots(); }, [date, turfId]);

    const calcDuration = (slot: Slot) => {
        const [sh, sm] = slot.start_time.split(':').map(Number);
        const [eh, em] = slot.end_time.split(':').map(Number);
        return ((eh * 60 + em) - (sh * 60 + sm)) / 60;
    };

    const confirmBooking = async () => {
        if (!user) return router.push('/login');
        if (!selectedSlot) return toast.error('Select a slot first');
        setBooking(true);
        try {
            const { data } = await api.post('/bookings', { slot_id: selectedSlot.id, notes });
            toast.success(`🎉 Booking confirmed! Total: ₹${data.total_amount}`);
            router.push('/customer');
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Booking failed');
        } finally { setBooking(false); }
    };

    return (
        <div className="max-w-6xl mx-auto px-4 py-10">
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
                                min={new Date().toISOString().split('T')[0]}
                                onChange={e => setDate(e.target.value)} />
                        </div>
                    </div>
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
                                const isSelected = selectedSlot?.id === slot.id;
                                const isAvailable = slot.status === 'available';
                                return (
                                    <button key={slot.id}
                                        disabled={!isAvailable}
                                        onClick={() => isAvailable && setSelectedSlot(isSelected ? null : slot)}
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
                        {selectedSlot ? (
                            <div className="space-y-4">
                                <div className="p-4 rounded-xl" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)' }}>
                                    <div className="text-sm text-slate-400 mb-1">Selected Slot</div>
                                    <div className="font-bold text-white text-lg">{selectedSlot.start_time.slice(0, 5)} – {selectedSlot.end_time.slice(0, 5)}</div>
                                    <div className="text-sm text-slate-400 mt-1">{date}</div>
                                </div>

                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between text-slate-400">
                                        <span>Duration</span>
                                        <span>{calcDuration(selectedSlot)} hr(s)</span>
                                    </div>
                                    <div className="flex justify-between text-slate-400">
                                        <span>Rate</span>
                                        <span>₹{selectedSlot.price_per_hour}/hr</span>
                                    </div>
                                    <div className="border-t border-white/10 pt-2 flex justify-between font-bold text-white text-lg">
                                        <span>Total</span>
                                        <span className="text-green-400">₹{(calcDuration(selectedSlot) * selectedSlot.price_per_hour).toLocaleString()}</span>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-sm text-slate-300 mb-2 block">Notes (optional)</label>
                                    <textarea className="input-field h-20 resize-none text-sm" placeholder="Team size, special requests..."
                                        value={notes} onChange={e => setNotes(e.target.value)} />
                                </div>

                                {user ? (
                                    <button onClick={confirmBooking} disabled={booking} className="btn-primary w-full justify-center py-3">
                                        {booking ? 'Confirming...' : '✅ Confirm Booking'}
                                    </button>
                                ) : (
                                    <button onClick={() => router.push('/login')} className="btn-primary w-full justify-center py-3">
                                        Login to Book
                                    </button>
                                )}

                                <p className="text-xs text-slate-500 text-center">* Pay at venue — booking is confirmed instantly</p>
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
        </div>
    );
}

export default function CustomerBookPage() {
    return <Suspense><BookPage /></Suspense>;
}
