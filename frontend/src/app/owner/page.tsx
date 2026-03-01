'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface Turf { id: number; name: string; location: string; city: string; sport_type: string; status: string; base_price: number; total_bookings: number; }
interface Slot { id: number; date: string; start_time: string; end_time: string; status: string; block_reason?: string; }
interface Booking { id: number; customer_name: string; customer_email: string; booking_date: string; start_time: string; end_time: string; total_amount: number; status: string; }

export default function OwnerDashboard() {
    const { user, logout } = useAuth();
    const router = useRouter();
    const [tab, setTab] = useState<'turfs' | 'add-turf' | 'slots' | 'pricing' | 'bookings' | 'booking-links'>('turfs');
    const [turfs, setTurfs] = useState<Turf[]>([]);
    const [slots, setSlots] = useState<Slot[]>([]);
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [selectedTurf, setSelectedTurf] = useState<number | null>(null);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(false);

    // Forms
    const [turfForm, setTurfForm] = useState({ name: '', description: '', location: '', city: '', sport_type: 'Football', facilities: '' });
    const [bulkForm, setBulkForm] = useState({ start_hour: 6, end_hour: 22, slot_duration: 60 });
    const [priceForm, setPriceForm] = useState({ rule_type: 'base', price_per_hour: '', label: '', start_time: '', end_time: '', day_of_week: '' });
    const [linkForm, setLinkForm] = useState({ date: new Date().toISOString().split('T')[0], start_time: '', end_time: '', price: '', expires_in_minutes: 10 });
    const [generatedLink, setGeneratedLink] = useState<{ url?: string; link?: string; token: string; expires_at: string } | null>(null);
    const [cancelConfirm, setCancelConfirm] = useState<number | null>(null);

    useEffect(() => {
        if (!user) return router.push('/login');
        if (user.role !== 'owner') return router.push('/');
        fetchMyTurfs();
    }, [user]);

    const fetchMyTurfs = async () => {
        try {
            const { data } = await api.get('/turfs/owner/my');
            setTurfs(data);
            if (data.length > 0 && !selectedTurf) setSelectedTurf(data[0].id);
        } catch { toast.error('Failed to load turfs'); }
    };

    const fetchSlots = async () => {
        if (!selectedTurf) return;
        setLoading(true);
        try {
            const { data } = await api.get(`/slots/owner?turf_id=${selectedTurf}&date=${selectedDate}`);
            setSlots(data);
        } catch { toast.error('Failed to load slots'); } finally { setLoading(false); }
    };

    const fetchBookings = async () => {
        if (!selectedTurf) return;
        setLoading(true);
        try {
            const { data } = await api.get(`/bookings/turf/${selectedTurf}`);
            setBookings(data);
        } catch { toast.error('Failed to load bookings'); } finally { setLoading(false); }
    };

    const handleTab = (t: typeof tab) => {
        setTab(t);
        if (t === 'slots') fetchSlots();
        if (t === 'bookings') fetchBookings();
    };

    const submitTurf = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.post('/turfs', { ...turfForm, facilities: turfForm.facilities.split(',').map(f => f.trim()) });
            toast.success('Turf submitted for admin approval!');
            setTurfForm({ name: '', description: '', location: '', city: '', sport_type: 'Football', facilities: '' });
            fetchMyTurfs();
            setTab('turfs');
        } catch (err: any) { toast.error(err.response?.data?.message || 'Error creating turf'); }
    };

    const generateSlots = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedTurf) return toast.error('Select a turf first');
        try {
            const { data } = await api.post('/slots/bulk', { turf_id: selectedTurf, date: selectedDate, ...bulkForm });
            toast.success(data.message);
            fetchSlots();
        } catch (err: any) { toast.error(err.response?.data?.message || 'Error generating slots'); }
    };

    const blockSlot = async (slotId: number, action: 'block' | 'unblock') => {
        try {
            await api.patch(`/slots/${slotId}/${action}`, {});
            toast.success(`Slot ${action}ed`);
            fetchSlots();
        } catch (err: any) { toast.error(err.response?.data?.message || 'Error'); }
    };

    const submitPricing = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedTurf) return toast.error('Select a turf');
        try {
            await api.post('/pricing', { turf_id: selectedTurf, ...priceForm, price_per_hour: parseFloat(priceForm.price_per_hour) });
            toast.success('Pricing rule saved!');
            setPriceForm({ rule_type: 'base', price_per_hour: '', label: '', start_time: '', end_time: '', day_of_week: '' });
        } catch (err: any) { toast.error(err.response?.data?.message || 'Error'); }
    };

    const generateBookingLink = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedTurf) return toast.error('Select a turf');
        try {
            const { data } = await api.post('/booking-links', {
                turf_id: selectedTurf,
                ...linkForm,
                price: parseFloat(linkForm.price)
            });
            toast.success('Link generated!');
            setGeneratedLink(data);
        } catch (err: any) { toast.error(err.response?.data?.message || 'Error generating link'); }
    };

    const cancelBooking = async (id: number) => {
        try {
            await api.patch(`/bookings/${id}/cancel`, { reason: 'Cancelled by owner' });
            toast.success('Booking cancelled successfully');
            fetchBookings();
            setCancelConfirm(null);
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Error cancelling booking');
        }
    };

    const SPORTS = ['Football', 'Cricket', 'Basketball', 'Tennis', 'Badminton', 'Hockey', 'Volleyball'];
    const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    return (
        <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-black text-white">Owner <span className="text-green-400">Dashboard</span></h1>
                    <p className="text-slate-400 mt-1">Manage your turfs and bookings</p>
                </div>
                <button onClick={() => { logout(); router.push('/'); }} className="btn-outline text-sm">Logout</button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-8 border-b border-white/10 flex-wrap">
                {[
                    { key: 'turfs', label: '🏟️ My Turfs' },
                    { key: 'add-turf', label: '➕ Add Turf' },
                    { key: 'slots', label: '📅 Slot Manager' },
                    { key: 'pricing', label: '💰 Pricing' },
                    { key: 'bookings', label: '📋 Bookings' },
                    { key: 'booking-links', label: '🔗 Booking Links' }
                ].map(t => (
                    <button key={t.key} onClick={() => handleTab(t.key as typeof tab)}
                        className={`px-4 py-3 text-sm font-semibold transition-all border-b-2 ${tab === t.key ? 'border-green-400 text-green-400' : 'border-transparent text-slate-400 hover:text-white'}`}>
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Turf selector (for slots/pricing/bookings/booking-links) */}
            {(tab === 'slots' || tab === 'pricing' || tab === 'bookings' || tab === 'booking-links') && (
                <div className="flex gap-4 mb-6 flex-wrap">
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-sm text-slate-400 mb-2">Select Turf</label>
                        <select className="input-field" value={selectedTurf || ''} onChange={e => setSelectedTurf(Number(e.target.value))}>
                            {turfs.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                    </div>
                    {tab === 'slots' && (
                        <div>
                            <label className="block text-sm text-slate-400 mb-2">Date</label>
                            <input type="date" className="input-field" value={selectedDate}
                                onChange={e => setSelectedDate(e.target.value)} min={new Date().toISOString().split('T')[0]} />
                        </div>
                    )}
                    {(tab === 'slots' || tab === 'bookings') && (
                        <div className="flex items-end">
                            <button onClick={tab === 'slots' ? fetchSlots : fetchBookings} className="btn-primary py-3">Load</button>
                        </div>
                    )}
                </div>
            )}

            {/* MY TURFS */}
            {tab === 'turfs' && (
                <div className="animate-fade-in">
                    {turfs.length === 0 ? (
                        <div className="glass-card p-12 text-center">
                            <div className="text-5xl mb-4">🏟️</div>
                            <p className="text-slate-400 mb-4">No turfs yet. Add your first turf!</p>
                            <button onClick={() => setTab('add-turf')} className="btn-primary">+ Add Turf</button>
                        </div>
                    ) : (
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {turfs.map(t => (
                                <div key={t.id} className="glass-card p-6">
                                    <div className="flex justify-between items-start mb-3">
                                        <h3 className="font-bold text-white text-lg">{t.name}</h3>
                                        <span className={`badge ${t.status === 'approved' ? 'badge-green' : t.status === 'pending' ? 'badge-yellow' : 'badge-red'}`}>{t.status}</span>
                                    </div>
                                    <p className="text-slate-400 text-sm mb-1">📍 {t.location}, {t.city}</p>
                                    <p className="text-slate-400 text-sm mb-3">⚽ {t.sport_type}</p>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-green-400 font-semibold">₹{t.base_price || 0}/hr</span>
                                        <span className="text-slate-400">{t.total_bookings || 0} bookings</span>
                                    </div>
                                    {t.status === 'pending' && <p className="mt-3 text-xs text-yellow-400">⏳ Awaiting admin approval</p>}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ADD TURF */}
            {tab === 'add-turf' && (
                <div className="max-w-2xl animate-fade-in">
                    <div className="glass-card p-8">
                        <h2 className="text-xl font-bold text-white mb-6">Register New Turf</h2>
                        <form onSubmit={submitTurf} className="space-y-5">
                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-slate-300 mb-2">Turf Name *</label>
                                    <input className="input-field" placeholder="Green Arena FC" value={turfForm.name}
                                        onChange={e => setTurfForm({ ...turfForm, name: e.target.value })} required />
                                </div>
                                <div>
                                    <label className="block text-sm text-slate-300 mb-2">Sport Type</label>
                                    <select className="input-field" value={turfForm.sport_type} onChange={e => setTurfForm({ ...turfForm, sport_type: e.target.value })}>
                                        {SPORTS.map(s => <option key={s}>{s}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-slate-300 mb-2">City *</label>
                                    <input className="input-field" placeholder="Mumbai" value={turfForm.city}
                                        onChange={e => setTurfForm({ ...turfForm, city: e.target.value })} required />
                                </div>
                                <div>
                                    <label className="block text-sm text-slate-300 mb-2">Location / Address *</label>
                                    <input className="input-field" placeholder="Andheri West" value={turfForm.location}
                                        onChange={e => setTurfForm({ ...turfForm, location: e.target.value })} required />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm text-slate-300 mb-2">Facilities (comma-separated)</label>
                                <input className="input-field" placeholder="Parking, Changing Rooms, Floodlights" value={turfForm.facilities}
                                    onChange={e => setTurfForm({ ...turfForm, facilities: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-300 mb-2">Description</label>
                                <textarea className="input-field h-24 resize-none" placeholder="Describe your turf..."
                                    value={turfForm.description} onChange={e => setTurfForm({ ...turfForm, description: e.target.value })} />
                            </div>
                            <button type="submit" className="btn-primary w-full justify-center py-3">Submit for Approval →</button>
                        </form>
                    </div>
                </div>
            )}

            {/* SLOT MANAGER */}
            {tab === 'slots' && (
                <div className="animate-fade-in space-y-6">
                    {/* Bulk generate */}
                    <div className="glass-card p-6">
                        <h3 className="font-bold text-white mb-4">⚡ Generate Slots for {selectedDate}</h3>
                        <form onSubmit={generateSlots} className="flex flex-wrap gap-4 items-end">
                            <div>
                                <label className="block text-sm text-slate-300 mb-2">Start Hour</label>
                                <input type="number" min={0} max={23} className="input-field w-24" value={bulkForm.start_hour}
                                    onChange={e => setBulkForm({ ...bulkForm, start_hour: Number(e.target.value) })} />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-300 mb-2">End Hour</label>
                                <input type="number" min={1} max={24} className="input-field w-24" value={bulkForm.end_hour}
                                    onChange={e => setBulkForm({ ...bulkForm, end_hour: Number(e.target.value) })} />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-300 mb-2">Duration (mins)</label>
                                <select className="input-field w-32" value={bulkForm.slot_duration}
                                    onChange={e => setBulkForm({ ...bulkForm, slot_duration: Number(e.target.value) })}>
                                    <option value={30}>30 min</option>
                                    <option value={60}>1 hour</option>
                                    <option value={90}>1.5 hours</option>
                                    <option value={120}>2 hours</option>
                                </select>
                            </div>
                            <button type="submit" className="btn-primary">Generate</button>
                        </form>
                    </div>

                    {/* Slot grid */}
                    <div className="glass-card p-6">
                        <h3 className="font-bold text-white mb-4">Slots for {selectedDate}</h3>
                        {loading ? <p className="text-slate-400">Loading...</p> :
                            slots.length === 0 ? <p className="text-slate-400">No slots found. Generate slots above.</p> : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                    {slots.map(slot => (
                                        <div key={slot.id} className={`relative rounded-xl p-3 text-center text-xs font-semibold transition-all group slot-${slot.status}`}>
                                            <div>{slot.start_time.slice(0, 5)}</div>
                                            <div className="text-xs mt-1 opacity-70">–</div>
                                            <div>{slot.end_time.slice(0, 5)}</div>
                                            <div className="mt-2 capitalize opacity-70">{slot.status}</div>
                                            {/* Block/unblock buttons */}
                                            {slot.status !== 'booked' && (
                                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all rounded-xl" style={{ background: 'rgba(0,0,0,0.7)' }}>
                                                    {slot.status === 'available' ? (
                                                        <button onClick={() => blockSlot(slot.id, 'block')} className="btn-danger text-xs py-1 px-2">Block</button>
                                                    ) : (
                                                        <button onClick={() => blockSlot(slot.id, 'unblock')} className="btn-primary text-xs py-1 px-2">Unblock</button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        <div className="flex gap-4 mt-4 text-xs text-slate-400 flex-wrap">
                            <span><span className="inline-block w-3 h-3 rounded-sm bg-green-500/30 mr-1"></span>Available</span>
                            <span><span className="inline-block w-3 h-3 rounded-sm bg-red-500/30 mr-1"></span>Booked</span>
                            <span><span className="inline-block w-3 h-3 rounded-sm bg-slate-600/30 mr-1"></span>Blocked</span>
                        </div>
                    </div>
                </div>
            )}

            {/* PRICING */}
            {tab === 'pricing' && (
                <div className="max-w-xl animate-fade-in">
                    <div className="glass-card p-8">
                        <h2 className="text-xl font-bold text-white mb-6">Set Pricing Rule</h2>
                        <form onSubmit={submitPricing} className="space-y-5">
                            <div>
                                <label className="block text-sm text-slate-300 mb-2">Rule Type</label>
                                <div className="flex rounded-xl overflow-hidden border border-white/10">
                                    {[{ v: 'base', l: '💰 Base (per hour)' }, { v: 'custom', l: '⚙️ Custom Rate' }].map(r => (
                                        <button key={r.v} type="button" onClick={() => setPriceForm({ ...priceForm, rule_type: r.v })}
                                            className={`flex-1 py-3 text-sm font-semibold transition-all ${priceForm.rule_type === r.v ? 'bg-green-500 text-white' : 'text-slate-400 hover:text-white'}`}>
                                            {r.l}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm text-slate-300 mb-2">Price Per Hour (₹) *</label>
                                <input type="number" className="input-field" placeholder="500" value={priceForm.price_per_hour}
                                    onChange={e => setPriceForm({ ...priceForm, price_per_hour: e.target.value })} required />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-300 mb-2">Label</label>
                                <input className="input-field" placeholder="e.g. Weekend Evening Rate" value={priceForm.label}
                                    onChange={e => setPriceForm({ ...priceForm, label: e.target.value })} />
                            </div>
                            {priceForm.rule_type === 'custom' && (
                                <>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm text-slate-300 mb-2">From Time</label>
                                            <input type="time" className="input-field" value={priceForm.start_time}
                                                onChange={e => setPriceForm({ ...priceForm, start_time: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="block text-sm text-slate-300 mb-2">To Time</label>
                                            <input type="time" className="input-field" value={priceForm.end_time}
                                                onChange={e => setPriceForm({ ...priceForm, end_time: e.target.value })} />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm text-slate-300 mb-2">Day of Week (optional)</label>
                                        <select className="input-field" value={priceForm.day_of_week}
                                            onChange={e => setPriceForm({ ...priceForm, day_of_week: e.target.value })}>
                                            <option value="">All Days</option>
                                            {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                                        </select>
                                    </div>
                                </>
                            )}
                            <button type="submit" className="btn-primary w-full justify-center py-3">Save Pricing Rule</button>
                        </form>
                    </div>
                </div>
            )}

            {/* BOOKINGS */}
            {tab === 'bookings' && (
                <div className="animate-fade-in overflow-x-auto">
                    {loading ? <p className="text-slate-400">Loading...</p> : (
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-white/10 text-left text-slate-400 text-sm">
                                    {['Customer', 'Date', 'Time', 'Amount', 'Status'].map(h => <th key={h} className="pb-4 pr-6 font-medium">{h}</th>)}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {bookings.map(b => (
                                    <tr key={b.id}>
                                        <td className="py-4 pr-6">
                                            <div className="font-medium text-white">{b.customer_name}</div>
                                            <div className="text-xs text-slate-400">{b.customer_email}</div>
                                        </td>
                                        <td className="py-4 pr-6 text-slate-300">{b.booking_date}</td>
                                        <td className="py-4 pr-6 text-slate-300">{b.start_time?.slice(0, 5)} – {b.end_time?.slice(0, 5)}</td>
                                        <td className="py-4 pr-6 text-green-400 font-semibold">₹{Number(b.total_amount).toLocaleString()}</td>
                                        <td className="py-4 pr-6">
                                            <span className={`badge ${b.status === 'confirmed' ? 'badge-green' : b.status === 'cancelled' ? 'badge-red' : 'badge-yellow'}`}>{b.status}</span>
                                            {b.status === 'confirmed' && (
                                                <button onClick={() => setCancelConfirm(b.id)} className="block mt-2 text-red-400 hover:text-red-300 text-xs underline">
                                                    Cancel booking
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {bookings.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-slate-400">No bookings yet</td></tr>}
                            </tbody>
                        </table>
                    )}
                    {cancelConfirm && (
                        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                            <div className="bg-slate-800 p-6 rounded-2xl border border-white/10 max-w-sm w-full shadow-2xl">
                                <h3 className="text-xl font-bold text-white mb-2">Cancel Booking?</h3>
                                <p className="text-slate-400 text-sm mb-6">Are you sure you want to cancel this booking? The time slot will immediately be unblocked and made available for others.</p>
                                <div className="flex gap-3">
                                    <button onClick={() => setCancelConfirm(null)} className="btn-outline flex-1 py-2">Keep it</button>
                                    <button onClick={() => cancelBooking(cancelConfirm)} className="btn-danger flex-1 py-2">Yes, Cancel</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* BOOKING LINKS */}
            {tab === 'booking-links' && (
                <div className="max-w-2xl animate-fade-in">
                    <div className="glass-card p-8">
                        <h2 className="text-xl font-bold text-white mb-6">Create Temporary Booking Link</h2>

                        <form onSubmit={generateBookingLink} className="space-y-5">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-slate-300 mb-2">Date</label>
                                    <input type="date" className="input-field" min={new Date().toISOString().split('T')[0]}
                                        value={linkForm.date} onChange={e => setLinkForm({ ...linkForm, date: e.target.value })} required />
                                </div>
                                <div>
                                    <label className="block text-sm text-slate-300 mb-2">Total Amount (₹)</label>
                                    <input type="number" step="0.01" className="input-field" placeholder="1000"
                                        value={linkForm.price} onChange={e => setLinkForm({ ...linkForm, price: e.target.value })} required />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-slate-300 mb-2">Start Time</label>
                                    <input type="time" className="input-field"
                                        value={linkForm.start_time} onChange={e => setLinkForm({ ...linkForm, start_time: e.target.value })} required />
                                </div>
                                <div>
                                    <label className="block text-sm text-slate-300 mb-2">End Time</label>
                                    <input type="time" className="input-field"
                                        value={linkForm.end_time} onChange={e => setLinkForm({ ...linkForm, end_time: e.target.value })} required />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm text-slate-300 mb-2">Expires In (Minutes)</label>
                                <input type="number" min="1" max="1440" className="input-field"
                                    value={linkForm.expires_in_minutes} onChange={e => setLinkForm({ ...linkForm, expires_in_minutes: Number(e.target.value) })} required />
                            </div>

                            <button type="submit" className="btn-primary w-full justify-center py-3">Generate Link</button>
                        </form>

                        {generatedLink && (
                            <div className="mt-8 p-6 bg-slate-800/50 border border-green-500/30 rounded-xl relative">
                                <h3 className="text-green-400 font-semibold mb-2">Link Generated Successfully!</h3>
                                <p className="text-slate-300 text-sm mb-4 break-all">{generatedLink.url || generatedLink.link}</p>
                                <p className="text-sm text-red-300 mb-4">Expires at: {new Date(generatedLink.expires_at).toLocaleString()}</p>
                                <button className="btn-outline w-full justify-center py-2" onClick={() => {
                                    navigator.clipboard.writeText(generatedLink.url || generatedLink.link || '');
                                    toast.success('Copied to clipboard');
                                }}>
                                    📋 Copy Link
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
