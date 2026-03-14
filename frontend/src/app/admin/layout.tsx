'use client';
import { useAuth } from '@/context/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
    ChartPieIcon, 
    TicketIcon, 
    UsersIcon, 
    CurrencyRupeeIcon, 
    PresentationChartLineIcon,
    ArrowLeftOnRectangleIcon,
    Bars3Icon,
    XMarkIcon,
    UserCircleIcon
} from '@heroicons/react/24/outline';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const { user, loading, logout } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    useEffect(() => {
        if (!loading && (!user || user.role !== 'super_admin')) {
            router.push('/');
        }
    }, [user, loading, router]);

    if (loading || !user || user.role !== 'super_admin') {
        return (
            <div className="min-h-screen bg-[#050510] flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-500"></div>
            </div>
        );
    }

    const menuItems = [
        { id: 'overview', name: 'System Stats', icon: ChartPieIcon, href: '/admin' },
        { id: 'turfs', name: 'Turf Approval', icon: TicketIcon, href: '/admin/turfs' },
        { id: 'users', name: 'User Directory', icon: UsersIcon, href: '/admin/users' },
        { id: 'payouts', name: 'Owner Payouts', icon: CurrencyRupeeIcon, href: '/admin/payouts' },
        { id: 'financials', name: 'Financial Hub', icon: PresentationChartLineIcon, href: '/admin/financials' },
    ];

    const currentTab = menuItems.find(item => item.href === pathname)?.id || 'overview';

    return (
        <div className="min-h-screen bg-[#050510]">
            {/* Top Bar / Mobile Header */}
            <header className="sticky top-0 z-30 h-16 border-b border-white/5 bg-[#050510]/80 backdrop-blur-xl px-4 lg:px-10 flex items-center justify-between lg:justify-end lg:ml-64">
                <div className="lg:hidden flex items-center gap-4">
                    <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 text-slate-400 hover:text-white transition-colors">
                        <Bars3Icon className="w-6 h-6" />
                    </button>
                    <span className="text-xl font-black text-white tracking-tighter italic">ADMIN<span className="text-blue-500">CORE</span></span>
                </div>

                <Link href="/admin/profile" className="flex items-center gap-3 group hover:bg-white/5 p-2 rounded-xl transition-all">
                    <div className="text-right">
                        <p className="text-slate-500 text-[8px] font-black uppercase tracking-widest leading-none mb-1">Session Active</p>
                        <p className="text-white text-xs font-bold leading-none">{user.name}</p>
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-blue-600/20 flex items-center justify-center border border-blue-500/30 group-hover:scale-110 transition-transform">
                        <UserCircleIcon className="w-5 h-5 text-blue-500" />
                    </div>
                </Link>
            </header>

            {/* Sidebar Overlay */}
            {isSidebarOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
            )}

            {/* Sidebar */}
            <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#0a0a1f] border-r border-white/5 transform transition-transform duration-300 lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="flex flex-col h-full">
                    <div className="flex items-center justify-between px-8 h-20 border-b border-white/5">
                        <span className="text-2xl font-black text-white tracking-widest italic uppercase">Admin<span className="text-blue-600">.</span></span>
                        <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 -mr-2 text-slate-500">
                            <XMarkIcon className="w-6 h-6" />
                        </button>
                    </div>

                    <nav className="flex-1 px-4 py-8 space-y-3">
                        {menuItems.map((item) => {
                            const isActive = pathname === item.href;
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => {
                                        router.push(item.href);
                                        setIsSidebarOpen(false);
                                    }}
                                    className={`w-full flex items-center gap-4 px-5 py-3.5 rounded-2xl transition-all duration-300 group ${isActive ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/30 font-bold' : 'text-slate-500 hover:bg-white/5 hover:text-white'}`}
                                >
                                    <item.icon className={`w-5 h-5 transition-colors ${isActive ? 'text-white' : 'text-slate-500 group-hover:text-blue-400'}`} />
                                    <span className="text-sm tracking-tight">{item.name}</span>
                                </button>
                            );
                        })}
                    </nav>

                    <div className="p-6 border-t border-white/5">
                        <button onClick={() => { logout(); router.push('/'); }} className="w-full flex items-center gap-4 px-5 py-3.5 text-slate-500 hover:text-red-500 transition-all rounded-2xl hover:bg-red-500/5">
                            <ArrowLeftOnRectangleIcon className="w-5 h-5" />
                            <span className="text-sm font-bold">Terminal Exit</span>
                        </button>
                    </div>
                </div>
            </aside>

            <main className="lg:ml-64">
                <div className="p-4 lg:p-10 max-w-7xl mx-auto space-y-10">
                    {/* Page Header */}
                    <div className="border-b border-white/5 pb-8">
                        <div className="flex items-center gap-3 text-blue-500 font-black text-[10px] uppercase tracking-[0.3em] mb-2">
                            <span className="w-8 h-px bg-blue-500/30"></span>
                            Command Center
                        </div>
                        <h1 className="text-4xl font-black text-white capitalize tracking-tighter">{currentTab.replace('-', ' ')}</h1>
                    </div>

                    {children}
                </div>
            </main>
        </div>
    );
}
