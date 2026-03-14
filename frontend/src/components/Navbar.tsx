'use client';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { useState } from 'react';
import { UserCircleIcon } from '@heroicons/react/24/outline';

export default function Navbar() {
    const { user, logout } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [open, setOpen] = useState(false);

    const handleLogout = () => { logout(); router.push('/'); };

    const dashboardLink = user?.role === 'super_admin' ? '/admin' : user?.role === 'owner' ? '/owner' : '/customer';

    // Hide global navbar on dashboard pages (Admin/Owner)
    if (pathname?.startsWith('/admin') || pathname?.startsWith('/owner')) return null;

    return (
        <nav className="sticky top-0 z-50 border-b border-white/10" style={{ background: 'rgba(13,13,26,0.9)', backdropFilter: 'blur(16px)' }}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    {/* Logo */}
                    <Link href="/" className="flex items-center gap-2 group">
                        <span className="text-2xl group-hover:rotate-12 transition-transform">🏏</span>
                        <span className="text-xl font-bold text-white tracking-tight">Turf<span className="text-green-400">Book</span></span>
                    </Link>

                    {/* Desktop nav */}
                    <div className="hidden md:flex items-center gap-6">
                        <Link href="/browse" className="text-slate-300 hover:text-green-400 transition-colors text-sm font-medium">Browse Turfs</Link>
                        {user ? (
                            <>
                                <Link href={dashboardLink} className="text-slate-300 hover:text-green-400 transition-colors text-sm font-medium">Dashboard</Link>
                                <Link href="/profile" className="flex items-center gap-2 group">
                                    <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center border border-green-500/20 group-hover:scale-110 transition-transform">
                                        <UserCircleIcon className="w-5 h-5 text-green-500" />
                                    </div>
                                    <span className="text-slate-300 text-sm font-medium group-hover:text-green-400 transition-colors">
                                        {user.name.split(' ')[0]}
                                    </span>
                                </Link>
                                <button onClick={handleLogout} className="btn-outline text-[10px] py-1.5 px-3 uppercase tracking-widest font-bold">Logout</button>
                            </>
                        ) : (
                            <>
                                <Link href="/login" className="text-slate-300 hover:text-green-400 transition-colors text-sm font-medium">Login</Link>
                                <Link href="/register" className="btn-primary text-sm py-2 px-5">Get Started</Link>
                            </>
                        )}
                    </div>

                    {/* Mobile hamburger */}
                    <button className="md:hidden text-white p-2" onClick={() => setOpen(!open)}>
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {open ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
                        </svg>
                    </button>
                </div>

                {/* Mobile menu */}
                {open && (
                    <div className="md:hidden pb-4 flex flex-col gap-3">
                        <Link href="/browse" className="text-slate-300 text-sm py-2" onClick={() => setOpen(false)}>Browse Turfs</Link>
                        {user ? (
                            <>
                                <Link href="/profile" className="text-slate-300 text-sm py-2" onClick={() => setOpen(false)}>Profile</Link>
                                <Link href={dashboardLink} className="text-slate-300 text-sm py-2" onClick={() => setOpen(false)}>Dashboard</Link>
                                <button onClick={handleLogout} className="btn-outline w-full text-sm">Logout</button>
                            </>
                        ) : (
                            <>
                                <Link href="/login" className="text-slate-300 text-sm py-2" onClick={() => setOpen(false)}>Login</Link>
                                <Link href="/register" className="btn-primary text-sm text-center" onClick={() => setOpen(false)}>Get Started</Link>
                            </>
                        )}
                    </div>
                )}
            </div>
        </nav>
    );
}
