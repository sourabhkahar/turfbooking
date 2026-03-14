'use client';
import { useAuth } from '@/context/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import Script from 'next/script';
import { 
    ChartBarIcon, 
    TicketIcon, 
    PlusCircleIcon, 
    CalendarDaysIcon, 
    CurrencyRupeeIcon, 
    ClipboardDocumentListIcon, 
    LinkIcon, 
    CreditCardIcon,
    ArrowLeftOnRectangleIcon,
    Bars3Icon,
    XMarkIcon,
    UserCircleIcon
} from '@heroicons/react/24/outline';
import Link from 'next/link';

const menuItems = [
    { id: 'overview', name: 'Overview', icon: ChartBarIcon, href: '/owner' },
    { id: 'turfs', name: 'My Turfs', icon: TicketIcon, href: '/owner/turfs' },
    { id: 'add-turf', name: 'Add Turf', icon: PlusCircleIcon, href: '/owner/add-turf' },
    { id: 'slots', name: 'Slot Manager', icon: CalendarDaysIcon, href: '/owner/slots' },
    { id: 'pricing', name: 'Pricing', icon: CurrencyRupeeIcon, href: '/owner/pricing' },
    { id: 'bookings', name: 'Bookings', icon: ClipboardDocumentListIcon, href: '/owner/bookings' },
    { id: 'booking-links', name: 'Booking Links', icon: LinkIcon, href: '/owner/booking-links' },
    { id: 'billing', name: 'Billing', icon: CreditCardIcon, href: '/owner/billing' },
];

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
    const { user, loading, logout } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    useEffect(() => {
        if (!loading && (!user || (user.role !== 'owner' && user.role !== 'super_admin'))) {
            router.push('/');
        }
    }, [user, loading, router]);

    if (loading || !user || (user.role !== 'owner' && user.role !== 'super_admin')) {
        return (
            <div className="min-h-screen bg-[#0d0d1a] flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-green-500"></div>
            </div>
        );
    }

    const currentTab = menuItems.find(item => item.href === pathname)?.id || 'overview';

    return (
        <div className="min-h-screen bg-[#0d0d1a]">
            <Script src="https://checkout.razorpay.com/v1/checkout.js" />
            
            {/* Top Bar / Mobile Header */}
            <header className="sticky top-0 z-30 h-16 border-b border-white/10 bg-[#0d0d1a]/80 backdrop-blur-xl px-4 lg:px-8 flex items-center justify-between lg:justify-end lg:ml-64">
                <div className="lg:hidden flex items-center gap-4">
                    <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 text-slate-400 hover:text-white transition-colors">
                        <Bars3Icon className="w-6 h-6" />
                    </button>
                    <span className="text-xl font-bold text-white tracking-widest uppercase">OWNER<span className="text-green-400">CORE</span></span>
                </div>

                <Link href="/owner/profile" className="flex items-center gap-3 group hover:bg-white/5 p-2 rounded-xl transition-all">
                    <div className="text-right">
                        <p className="text-slate-500 text-[8px] font-black uppercase tracking-widest leading-none mb-1">Owner Active</p>
                        <p className="text-white text-xs font-bold leading-none">{user.name}</p>
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center border border-green-500/20 group-hover:scale-110 transition-transform">
                        <UserCircleIcon className="w-5 h-5 text-green-500" />
                    </div>
                </Link>
            </header>

            {/* Sidebar Overlay */}
            {isSidebarOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
            )}

            {/* Sidebar */}
            <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#0d0d1a] border-r border-white/10 transform transition-transform duration-300 lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="flex flex-col h-full">
                    <div className="flex items-center justify-between px-6 h-20 border-b border-white/5 flex-shrink-0">
                        <span className="text-2xl font-black text-white tracking-tighter uppercase">Turf<span className="text-green-500">Pro</span></span>
                        <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 -mr-2 text-slate-500">
                            <XMarkIcon className="w-6 h-6" />
                        </button>
                    </div>

                    <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
                        {menuItems.map((item) => {
                            const isActive = pathname === item.href;
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => {
                                        router.push(item.href);
                                        setIsSidebarOpen(false);
                                    }}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${isActive ? 'bg-green-500 text-white shadow-lg shadow-green-500/20' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                                >
                                    <item.icon className="w-5 h-5" />
                                    <span className="text-sm font-semibold">{item.name}</span>
                                </button>
                            );
                        })}
                    </nav>

                    <div className="p-4 border-t border-white/5">
                        <button onClick={() => { logout(); router.push('/'); }} className="w-full flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-red-400 transition-colors rounded-xl">
                            <ArrowLeftOnRectangleIcon className="w-5 h-5" />
                            <span className="text-sm font-semibold">Logout</span>
                        </button>
                    </div>
                </div>
            </aside>

            <main className="lg:ml-64 min-h-screen">
                <div className="p-4 lg:p-8 pt-6 lg:pt-10 max-w-6xl mx-auto space-y-8">
                    {/* Page Header */}
                    <div className="space-y-1">
                        <h1 className="text-3xl font-black text-white capitalize">{currentTab.replace('-', ' ')} <span className="text-green-400">Hub</span></h1>
                        <p className="text-slate-400 text-sm">Managing your sports facility network</p>
                    </div>

                    {children}
                </div>
            </main>
        </div>
    );
}
