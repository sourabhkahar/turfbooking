'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { 
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar
} from 'recharts';
import { 
    UsersIcon, 
    TicketIcon, 
    CurrencyRupeeIcon, 
    ArrowTrendingUpIcon,
    ServerIcon
} from '@heroicons/react/24/outline';

interface AdminStats {
    summary: { total_users: number; total_turfs: number; total_bookings: number; total_revenue: number; };
    charts: {
        daily: { booking_date: string; revenue: number; count: number }[];
        by_sport: { sport_type: string; count: number }[];
    };
}

export default function AdminOverview() {
    const [stats, setStats] = useState<AdminStats | null>(null);

    useEffect(() => {
        api.get('/admin/stats').then(({ data }) => setStats(data)).catch(() => {});
    }, []);

    if (!stats) return <div className="flex justify-center py-24"><div className="animate-pulse flex flex-col items-center gap-4"><ServerIcon className="w-12 h-12 text-blue-500/50" /><p className="text-slate-500 font-black text-[10px] tracking-widest uppercase">Syncing with Mainframe...</p></div></div>;

    return (
        <div className="animate-fade-in space-y-12">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: "Total Network Users", val: stats.summary.total_users, color: "text-blue-400", bg: "bg-blue-400/5", icon: UsersIcon },
                    { label: "Active Facilities", val: stats.summary.total_turfs, color: "text-purple-400", bg: "bg-purple-400/5", icon: TicketIcon },
                    { label: "Platform Volume", val: stats.summary.total_bookings, color: "text-cyan-400", bg: "bg-cyan-400/5", icon: ArrowTrendingUpIcon },
                    { label: "Gross Revenue", val: `₹${stats.summary.total_revenue.toLocaleString()}`, color: "text-emerald-400", bg: "bg-emerald-400/5", icon: CurrencyRupeeIcon },
                ].map((card, i) => (
                    <div key={i} className="glass-card p-8 border-l border-white/5 hover:border-blue-500/20 transition-all group">
                        <div className="flex flex-col gap-6">
                            <div className={`w-12 h-12 rounded-2xl ${card.bg} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                                <card.icon className={`w-6 h-6 ${card.color}`} />
                            </div>
                            <div>
                                <h4 className="text-3xl font-black text-white tracking-tighter">{card.val}</h4>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mt-1">{card.label}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
                <div className="glass-card p-8 lg:col-span-2">
                    <div className="flex items-center justify-between mb-10">
                        <h3 className="text-sm font-black text-white uppercase tracking-widest">Revenue Velocity</h3>
                        <div className="px-3 py-1 bg-emerald-500/10 text-emerald-400 text-[10px] font-black rounded-full">+12.5% vs Last Period</div>
                    </div>
                    <div className="h-[350px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={stats.charts.daily}>
                                <defs>
                                    <linearGradient id="adminRev" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                                <XAxis dataKey="booking_date" stroke="#475569" fontSize={10} axisLine={false} tickLine={false} />
                                <YAxis stroke="#475569" fontSize={10} axisLine={false} tickLine={false} />
                                <Tooltip contentStyle={{ backgroundColor: '#050510', border: '1px solid #ffffff10', borderRadius: '16px' }} />
                                <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={3} fill="url(#adminRev)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="glass-card p-8">
                    <h3 className="text-sm font-black text-white uppercase tracking-widest mb-10">Sport Popularity</h3>
                    <div className="h-[350px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.charts.by_sport} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" horizontal={false} />
                                <XAxis type="number" hide />
                                <YAxis dataKey="sport_type" type="category" stroke="#475569" fontSize={10} axisLine={false} tickLine={false} width={80} />
                                <Tooltip contentStyle={{ backgroundColor: '#050510', border: '1px solid #ffffff10', borderRadius: '16px' }} />
                                <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
}
