'use client';
import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { CheckBadgeIcon, XCircleIcon, MapPinIcon } from '@heroicons/react/24/outline';

import Pagination from '@/components/Pagination';

interface Turf { id: number; name: string; location: string; city: string; sport_type: string; status: string; owner_name: string; }

export default function AdminTurfs() {
    const [turfs, setTurfs] = useState<Turf[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const itemsPerPage = 10;

    const fetchTurfs = useCallback(async () => {
        try {
            const { data: response } = await api.get(`/admin/turfs?page=${currentPage}&limit=${itemsPerPage}`);
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
            await fetchTurfs();
        };
        load();
    }, [fetchTurfs]);

    const currentData = turfs;

    const handleAction = async (id: number, status: string) => {
        try {
            await api.patch(`/turfs/${id}/status`, { status });
            toast.success(`Turf ${status} successfully`);
            fetchTurfs();
        } catch { }
    };

    return (
        <div className="animate-fade-in space-y-8">
            <div className="glass-card overflow-hidden border-t-4 border-blue-600">
                <div className="p-8 border-b border-white/5 bg-white/5 flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-black text-white uppercase tracking-widest">Facility Registry</h3>
                        <p className="text-[10px] text-slate-500 font-bold mt-1">Manage network venue approvals</p>
                    </div>
                </div>
                <div className="table-responsive">
                    <table className="modern-table">
                        <thead>
                            <tr>
                                <th>VENUE NAME</th>
                                <th>LOCATION</th>
                                <th>OWNER</th>
                                <th>SPORT</th>
                                <th>STATUS</th>
                                <th>INTERCEPT</th>
                            </tr>
                        </thead>
                        <tbody>
                            {currentData.map(t => (
                                <tr key={t.id} className="hover:bg-white/5 transition-colors group">
                                    <td className="font-black text-white group-hover:text-blue-400 transition-colors uppercase">{t.name}</td>
                                    <td>
                                        <div className="flex items-center gap-2 text-slate-400 font-medium">
                                            <MapPinIcon className="w-3 h-3" /> {t.city}
                                        </div>
                                    </td>
                                    <td className="font-bold text-slate-300">{t.owner_name}</td>
                                    <td><span className="text-[10px] font-black text-blue-500 bg-blue-500/10 px-2 py-1 rounded-md">{t.sport_type}</span></td>
                                    <td><span className={`badge ${t.status === 'approved' ? 'badge-green' : t.status === 'pending' ? 'badge-yellow' : t.status === 'rejected' ? 'badge-red' : 'badge-red'}`}>{t.status}</span></td>
                                    <td>
                                        <div className="flex gap-2">
                                            {t.status === 'pending' && (
                                                <>
                                                    <button onClick={() => handleAction(t.id, 'approved')} className="p-3 bg-green-500/10 text-green-400 rounded-xl hover:bg-green-500 hover:text-white transition-all"><CheckBadgeIcon className="w-4 h-4" /></button>
                                                    <button onClick={() => handleAction(t.id, 'rejected')} className="p-3 bg-red-500/10 text-red-400 rounded-xl hover:bg-red-500 hover:text-white transition-all"><XCircleIcon className="w-4 h-4" /></button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <Pagination 
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                />
            </div>
        </div>
    );
}
