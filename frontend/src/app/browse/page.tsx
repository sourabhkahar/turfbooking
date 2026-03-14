'use client';
import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import Link from 'next/link';
import toast from 'react-hot-toast';
import Pagination from '@/components/Pagination';

interface Turf { id: number; name: string; location: string; city: string; sport_type: string; status: string; base_price: number; owner_name: string; facilities: string; }

export default function BrowsePage() {
    const [turfs, setTurfs] = useState<Turf[]>([]);
    const [search, setSearch] = useState('');
    const [city, setCity] = useState('');
    const [sport, setSport] = useState('');
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const itemsPerPage = 12;

    const fetchTurfs = useCallback(async () => {
        setLoading(true);
        try {
            const params: Record<string, string> = { page: currentPage.toString(), limit: itemsPerPage.toString() };
            if (search) params.search = search;
            if (city) params.city = city;
            if (sport) params.sport_type = sport;
            const qs = new URLSearchParams(params).toString();
            const { data: response } = await api.get(`/turfs?${qs}`);
            if (response.data) {
                setTurfs(response.data);
                setTotalPages(response.totalPages);
            } else {
                setTurfs(response);
            }
        } catch { toast.error('Failed to load turfs'); } finally { setLoading(false); }
    }, [currentPage, search, city, sport, itemsPerPage]);

    useEffect(() => { fetchTurfs(); }, [fetchTurfs]);

    const handleSearch = () => {
        setCurrentPage(1);
        fetchTurfs();
    };

    const SPORTS = ['', 'Football', 'Cricket', 'Basketball', 'Tennis', 'Badminton', 'Hockey', 'Volleyball'];

    const parseFacilities = (f: string) => {
        try { return JSON.parse(f) as string[]; } catch { return []; }
    };

    return (
        <div className="max-w-7xl mx-auto px-4 py-10">
            <div className="mb-8">
                <h1 className="text-3xl font-black text-white mb-2">Browse <span className="text-green-400">Turfs</span></h1>
                <p className="text-slate-400">Find the perfect turf for your game</p>
            </div>

            {/* Filters */}
            <div className="glass-card p-6 mb-8">
                <div className="flex flex-wrap gap-4">
                    <div className="flex-1 min-w-[200px]">
                        <input className="input-field" placeholder="🔍 Search by name or location..."
                            value={search} onChange={e => setSearch(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && fetchTurfs()} />
                    </div>
                    <div className="min-w-[140px]">
                        <input className="input-field" placeholder="City" value={city} onChange={e => setCity(e.target.value)} />
                    </div>
                    <div className="min-w-[160px]">
                        <select className="input-field" value={sport} onChange={e => setSport(e.target.value)}>
                            {SPORTS.map(s => <option key={s} value={s}>{s || 'All Sports'}</option>)}
                        </select>
                    </div>
                    <button onClick={handleSearch} className="btn-primary">Search</button>
                </div>
            </div>

            {/* Results */}
            {loading ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="glass-card p-6 animate-pulse">
                            <div className="h-4 bg-white/10 rounded mb-3 w-2/3"></div>
                            <div className="h-3 bg-white/10 rounded mb-2 w-1/2"></div>
                            <div className="h-3 bg-white/10 rounded w-1/3"></div>
                        </div>
                    ))}
                </div>
            ) : turfs.length === 0 ? (
                <div className="text-center py-20">
                    <div className="text-5xl mb-4">🏟️</div>
                    <p className="text-slate-400 text-lg">No turfs found. Try a different search.</p>
                </div>
            ) : (
                <>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {turfs.map(t => {
                            const facs = parseFacilities(t.facilities);
                            return (
                                <div key={t.id} className="glass-card p-6 group hover:border-green-500/30 transition-all duration-300">
                                    <div className="flex justify-between items-start mb-3">
                                        <span className="text-xs font-semibold text-green-400 bg-green-400/10 px-2 py-1 rounded-full">{t.sport_type}</span>
                                        {t.base_price && <span className="text-green-400 font-bold text-lg">₹{t.base_price}/hr</span>}
                                    </div>
                                    <h3 className="text-xl font-bold text-white mb-1 group-hover:text-green-400 transition-colors">{t.name}</h3>
                                    <p className="text-slate-400 text-sm mb-1">📍 {t.location}, {t.city}</p>
                                    <p className="text-slate-500 text-xs mb-4">👤 {t.owner_name}</p>
                                    {facs.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mb-4">
                                            {facs.slice(0, 3).map((f: string) => (
                                                <span key={f} className="text-xs bg-white/5 border border-white/10 px-2 py-1 rounded-full text-slate-400">{f}</span>
                                            ))}
                                            {facs.length > 3 && <span className="text-xs text-slate-500">+{facs.length - 3} more</span>}
                                        </div>
                                    )}
                                    <Link href={`/customer/book?turf_id=${t.id}`} className="btn-primary w-full justify-center text-sm py-2.5">
                                        View & Book →
                                    </Link>
                                </div>
                            );
                        })}
                    </div>
                    <div className="mt-8">
                        <Pagination 
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageChange={setCurrentPage}
                        />
                    </div>
                </>
            )}
        </div>
    );
}
