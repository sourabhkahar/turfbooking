'use client';
import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import { TicketIcon, MapPinIcon, CheckCircleIcon, PencilSquareIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';

import Pagination from '@/components/Pagination';

interface Turf { id: number; name: string; location: string; city: string; sport_type: string; status: string; base_price: number; total_bookings: number; }

export default function MyTurfs() {
    const [turfs, setTurfs] = useState<Turf[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const itemsPerPage = 6;

    const fetchMyTurfs = useCallback(async () => {
        try {
            const { data: response } = await api.get(`/turfs/owner/my?page=${currentPage}&limit=${itemsPerPage}`);
            if (response.data) {
                setTurfs(response.data);
                setTotalPages(response.totalPages);
            } else {
                setTurfs(response);
            }
        } catch { }
    }, [currentPage, itemsPerPage]);

    useEffect(() => {
        const load = async () => {
            await fetchMyTurfs();
        };
        load();
    }, [fetchMyTurfs]);

    const currentData = turfs;

    return (
        <div className="animate-fade-in space-y-6">
            {turfs.length === 0 ? (
                <div className="glass-card p-16 text-center space-y-4">
                    <div className="text-6xl">🏟️</div>
                    <h3 className="text-xl font-bold text-white">No Turfs Registered</h3>
                    <p className="text-slate-400 max-w-sm mx-auto">Start growing your network by adding your first sports facility today.</p>
                </div>
            ) : (
                <>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {currentData.map(t => (
                            <div key={t.id} className="glass-card p-6 group hover:border-green-500/30 transition-all">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="p-3 bg-white/5 rounded-2xl group-hover:scale-110 transition-transform"><TicketIcon className="w-6 h-6 text-green-400" /></div>
                                    <span className={`badge ${t.status === 'approved' ? 'badge-green' : t.status === 'pending' ? 'badge-yellow' : 'badge-red'}`}>{t.status}</span>
                                </div>
                                <h3 className="text-lg font-black text-white mb-2">{t.name}</h3>
                                <div className="space-y-1.5 mb-6">
                                    <p className="text-xs text-slate-400 flex items-center gap-2"><MapPinIcon className="w-3 h-3" /> {t.location}, {t.city}</p>
                                    <p className="text-xs text-slate-400 flex items-center gap-2"><CheckCircleIcon className="w-3 h-3" /> {t.sport_type}</p>
                                </div>
                                <div className="flex justify-between items-center pt-4 border-t border-white/5">
                                    <span className="text-lg font-black text-green-400">₹{t.base_price || 0}<span className="text-[10px] text-slate-500 font-bold">/HR</span></span>
                                    <Link href={`/owner/turfs/edit/${t.id}`} className="p-2 bg-white/5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest">
                                        <PencilSquareIcon className="w-4 h-4" /> Edit
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>
                    <Pagination 
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={setCurrentPage}
                    />
                </>
            )}
        </div>
    );
}
