'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
    AreaChart, Area
} from 'recharts';
import { 
    CalendarDaysIcon, 
    CurrencyRupeeIcon, 
    TicketIcon, 
    ClockIcon,
    ChartBarIcon
} from '@heroicons/react/24/outline';

interface DashboardStats {
    summary: { today_bookings: number; monthly_revenue: number; total_bookings: number; upcoming_bookings: number; };
    charts: {
        daily: { booking_date: string; count: number; revenue: number }[];
        by_turf: { name: string; revenue: number }[];
    };
}

export default function OwnerOverview() {
    const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);

    useEffect(() => {
        fetchDashboardStats();
    }, []);

    const fetchDashboardStats = async () => {
        try {
            const { data } = await api.get('/owner/stats');
            setDashboardStats(data);
        } catch { }
    };

    if (!dashboardStats) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-green-400" /></div>;

    return (
        <div className="animate-fade-in space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: "Today's Games", val: dashboardStats.summary.today_bookings, color: "text-blue-400", bg: "bg-blue-400/10", icon: CalendarDaysIcon },
                    { label: "Monthly Rev", val: `₹${dashboardStats.summary.monthly_revenue.toLocaleString()}`, color: "text-green-400", bg: "bg-green-400/10", icon: CurrencyRupeeIcon },
                    { label: "Total Bookings", val: dashboardStats.summary.total_bookings, color: "text-purple-400", bg: "bg-purple-400/10", icon: TicketIcon },
                    { label: "Upcoming", val: dashboardStats.summary.upcoming_bookings, color: "text-orange-400", bg: "bg-orange-400/10", icon: ClockIcon },
                ].map((card, i) => (
                    <div key={i} className="glass-card p-6 border-b-2 border-white/5 hover:border-green-500/20 transition-all">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">{card.label}</p>
                                <h4 className={`text-2xl font-black ${card.color}`}>{card.val}</h4>
                            </div>
                            <div className={`p-2 rounded-lg ${card.bg}`}><card.icon className={`w-5 h-5 ${card.color}`} /></div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
                <div className="glass-card p-6">
                    <h3 className="text-sm font-bold text-slate-300 mb-6 flex items-center gap-2"><ChartBarIcon className="w-4 h-4" /> Weekly Performance</h3>
                    <div className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={dashboardStats.charts.daily}>
                                <defs>
                                    <linearGradient id="colCount" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
                                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                                <XAxis dataKey="booking_date" stroke="#475569" fontSize={10} tickFormatter={v => v.split('-').slice(1).reverse().join('/')} />
                                <YAxis stroke="#475569" fontSize={10} axisLine={false} tickLine={false} />
                                <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #ffffff10', borderRadius: '12px' }} />
                                <Area type="monotone" dataKey="count" stroke="#22c55e" strokeWidth={2} fill="url(#colCount)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="glass-card p-6">
                    <h3 className="text-sm font-bold text-slate-300 mb-6 flex items-center gap-2"><CurrencyRupeeIcon className="w-4 h-4" /> Revenue Distribution</h3>
                    <div className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={dashboardStats.charts.by_turf}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                                <XAxis dataKey="name" stroke="#475569" fontSize={10} />
                                <YAxis stroke="#475569" fontSize={10} axisLine={false} tickLine={false} />
                                <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #ffffff10', borderRadius: '12px' }} />
                                <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
}
