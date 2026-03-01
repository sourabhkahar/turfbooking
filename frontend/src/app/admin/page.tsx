'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface Stats { total_users: number; total_owners: number; total_turfs: number; pending_turfs: number; total_bookings: number; total_revenue: number; }
interface Turf { id: number; name: string; owner_name: string; city: string; status: string; created_at: string; }
interface User { id: number; name: string; email: string; role: string; status: string; }

export default function AdminDashboard() {
    const { user, logout } = useAuth();
    const router = useRouter();
    const [stats, setStats] = useState<Stats | null>(null);
    const [turfs, setTurfs] = useState<Turf[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [tab, setTab] = useState<'overview' | 'turfs' | 'users'>('overview');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!user) return router.push('/login');
        if (user.role !== 'super_admin') return router.push('/');
        fetchStats();
    }, [user]);

    const fetchStats = async () => {
        try {
            const { data } = await api.get('/admin/stats');
            setStats(data);
        } catch { toast.error('Failed to load stats'); }
    };

    const fetchTurfs = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/admin/turfs');
            setTurfs(data);
        } catch { toast.error('Failed to load turfs'); } finally { setLoading(false); }
    };

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/admin/users');
            setUsers(data);
        } catch { toast.error('Failed to load users'); } finally { setLoading(false); }
    };

    const statusTurf = async (id: number, status: string) => {
        try {
            await api.patch(`/turfs/${id}/status`, { status });
            toast.success(`Turf ${status}`);
            fetchTurfs();
        } catch { toast.error('Error updating turf'); }
    };

    const toggleUser = async (id: number, currentStatus: string) => {
        const newStatus = currentStatus === 'active' ? 'disabled' : 'active';
        try {
            await api.patch(`/admin/users/${id}/status`, { status: newStatus });
            toast.success(`User ${newStatus}`);
            fetchUsers();
        } catch { toast.error('Error updating user'); }
    };

    const handleTab = (t: typeof tab) => {
        setTab(t);
        if (t === 'turfs') fetchTurfs();
        if (t === 'users') fetchUsers();
    };

    const statCards = stats ? [
        { label: 'Total Players', value: stats.total_users, icon: '👥', color: 'text-blue-400' },
        { label: 'Turf Owners', value: stats.total_owners, icon: '🏟️', color: 'text-purple-400' },
        { label: 'Total Turfs', value: stats.total_turfs, icon: '⚽', color: 'text-green-400' },
        { label: 'Pending Approval', value: stats.pending_turfs, icon: '⏳', color: 'text-yellow-400' },
        { label: 'Total Bookings', value: stats.total_bookings, icon: '📋', color: 'text-cyan-400' },
        { label: 'Total Revenue', value: `₹${Number(stats.total_revenue).toLocaleString()}`, icon: '💰', color: 'text-green-400' },
    ] : [];

    return (
        <div className="max-w-7xl mx-auto px-4 py-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-black text-white">Super Admin <span className="text-green-400">Panel</span></h1>
                    <p className="text-slate-400 mt-1">Manage the entire platform</p>
                </div>
                <button onClick={() => { logout(); router.push('/'); }} className="btn-outline text-sm">Logout</button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-8 border-b border-white/10">
                {(['overview', 'turfs', 'users'] as const).map(t => (
                    <button key={t} onClick={() => handleTab(t)}
                        className={`px-5 py-3 text-sm font-semibold capitalize transition-all border-b-2 ${tab === t ? 'border-green-400 text-green-400' : 'border-transparent text-slate-400 hover:text-white'}`}>
                        {t === 'overview' ? '📊 Overview' : t === 'turfs' ? '🏟️ Turfs' : '👥 Users'}
                    </button>
                ))}
            </div>

            {/* Overview */}
            {tab === 'overview' && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-5 animate-fade-in">
                    {statCards.map(s => (
                        <div key={s.label} className="glass-card p-6">
                            <div className="text-3xl mb-3">{s.icon}</div>
                            <div className={`text-3xl font-black ${s.color}`}>{s.value}</div>
                            <div className="text-slate-400 text-sm mt-1">{s.label}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* Turfs */}
            {tab === 'turfs' && (
                <div className="animate-fade-in">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-white/10 text-left text-slate-400 text-sm">
                                    {['Turf', 'Owner', 'City', 'Status', 'Actions'].map(h => <th key={h} className="pb-4 pr-6 font-medium">{h}</th>)}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {turfs.map(t => (
                                    <tr key={t.id} className="py-4">
                                        <td className="py-4 pr-6 font-medium text-white">{t.name}</td>
                                        <td className="py-4 pr-6 text-slate-400">{t.owner_name}</td>
                                        <td className="py-4 pr-6 text-slate-400">{t.city}</td>
                                        <td className="py-4 pr-6">
                                            <span className={`badge ${t.status === 'approved' ? 'badge-green' : t.status === 'pending' ? 'badge-yellow' : 'badge-red'}`}>{t.status}</span>
                                        </td>
                                        <td className="py-4 pr-6">
                                            <div className="flex gap-2">
                                                {t.status === 'pending' && <>
                                                    <button onClick={() => statusTurf(t.id, 'approved')} className="btn-primary text-xs py-1">Approve</button>
                                                    <button onClick={() => statusTurf(t.id, 'rejected')} className="btn-danger text-xs py-1">Reject</button>
                                                </>}
                                                {t.status === 'approved' && <span className="badge badge-green">Active</span>}
                                                {t.status === 'rejected' && <span className="badge badge-red">Rejected</span>}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {!loading && turfs.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-slate-400">No turfs found</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Users */}
            {tab === 'users' && (
                <div className="animate-fade-in overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-white/10 text-left text-slate-400 text-sm">
                                {['Name', 'Email', 'Role', 'Status', 'Action'].map(h => <th key={h} className="pb-4 pr-6 font-medium">{h}</th>)}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {users.map(u => (
                                <tr key={u.id}>
                                    <td className="py-4 pr-6 font-medium text-white">{u.name}</td>
                                    <td className="py-4 pr-6 text-slate-400">{u.email}</td>
                                    <td className="py-4 pr-6"><span className={`badge ${u.role === 'owner' ? 'badge-yellow' : 'badge-gray'}`}>{u.role}</span></td>
                                    <td className="py-4 pr-6"><span className={`badge ${u.status === 'active' ? 'badge-green' : 'badge-red'}`}>{u.status}</span></td>
                                    <td className="py-4 pr-6">
                                        {u.role !== 'super_admin' && (
                                            <button onClick={() => toggleUser(u.id, u.status)}
                                                className={`text-xs py-1 px-3 rounded-lg font-semibold ${u.status === 'active' ? 'btn-danger' : 'btn-primary'}`}>
                                                {u.status === 'active' ? 'Disable' : 'Enable'}
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
