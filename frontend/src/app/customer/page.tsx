'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface Booking { id: number; turf_name: string; location: string; city: string; booking_date: string; start_time: string; end_time: string; total_amount: number; status: string; payment_status: string; }

export default function CustomerPage() {
    const { user, logout } = useAuth();
    const router = useRouter();
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return router.push('/login');
        if (user.role === 'owner') return router.push('/owner');
        if (user.role === 'super_admin') return router.push('/admin');
        fetchBookings();
    }, [user]);

    const fetchBookings = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/bookings/my');
            setBookings(data);
        } catch { toast.error('Failed to load bookings'); } finally { setLoading(false); }
    };

    const cancelBooking = async (id: number) => {
        if (!confirm('Are you sure you want to cancel this booking?')) return;
        try {
            await api.patch(`/bookings/${id}/cancel`, {});
            toast.success('Booking cancelled');
            fetchBookings();
        } catch (err: any) { toast.error(err.response?.data?.message || 'Error'); }
    };

    const upcoming = bookings.filter(b => b.status === 'confirmed' && new Date(b.booking_date) >= new Date());
    const past = bookings.filter(b => b.status !== 'confirmed' || new Date(b.booking_date) < new Date());

    return (
        <div className="max-w-5xl mx-auto px-4 py-10">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-black text-white">My <span className="text-green-400">Bookings</span></h1>
                    <p className="text-slate-400 mt-1">Hi {user?.name}! Manage your game sessions</p>
                </div>
                <div className="flex gap-3">
                    <Link href="/browse" className="btn-primary text-sm">🔍 Browse Turfs</Link>
                    <button onClick={() => { logout(); router.push('/'); }} className="btn-outline text-sm">Logout</button>
                </div>
            </div>

            {loading ? (
                <div className="space-y-4">
                    {[1, 2, 3].map(i => <div key={i} className="glass-card p-6 animate-pulse h-28" />)}
                </div>
            ) : bookings.length === 0 ? (
                <div className="glass-card p-16 text-center">
                    <div className="text-5xl mb-4">📋</div>
                    <h2 className="text-xl font-bold text-white mb-2">No bookings yet</h2>
                    <p className="text-slate-400 mb-6">Book your first game session today!</p>
                    <Link href="/browse" className="btn-primary">Browse Turfs →</Link>
                </div>
            ) : (
                <div className="space-y-8">
                    {upcoming.length > 0 && (
                        <div>
                            <h2 className="text-lg font-bold text-white mb-4">🟢 Upcoming ({upcoming.length})</h2>
                            <div className="space-y-4">
                                {upcoming.map(b => (
                                    <BookingCard key={b.id} b={b} onCancel={cancelBooking} showCancel />
                                ))}
                            </div>
                        </div>
                    )}
                    {past.length > 0 && (
                        <div>
                            <h2 className="text-lg font-bold text-white mb-4 opacity-60">📁 History ({past.length})</h2>
                            <div className="space-y-3 opacity-70">
                                {past.map(b => <BookingCard key={b.id} b={b} onCancel={cancelBooking} showCancel={false} />)}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function BookingCard({ b, onCancel, showCancel }: { b: Booking; onCancel: (id: number) => void; showCancel: boolean }) {
    return (
        <div className="glass-card p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex gap-4">
                <div className="w-12 h-12 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-2xl flex-shrink-0">
                    ⚽
                </div>
                <div>
                    <h3 className="font-bold text-white">{b.turf_name}</h3>
                    <p className="text-slate-400 text-sm">📍 {b.location}, {b.city}</p>
                    <p className="text-slate-400 text-sm mt-1">
                        📅 {b.booking_date} &nbsp;·&nbsp; ⏰ {b.start_time?.slice(0, 5)} – {b.end_time?.slice(0, 5)}
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-4 flex-shrink-0">
                <div className="text-right">
                    <div className="text-green-400 font-bold text-xl">₹{Number(b.total_amount).toLocaleString()}</div>
                    <span className={`badge ${b.status === 'confirmed' ? 'badge-green' : 'badge-red'}`}>{b.status}</span>
                </div>
                {showCancel && b.status === 'confirmed' && (
                    <button onClick={() => onCancel(b.id)} className="btn-danger text-xs">Cancel</button>
                )}
            </div>
        </div>
    );
}
