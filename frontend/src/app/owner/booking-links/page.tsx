'use client';
import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { LinkIcon, ShareIcon } from '@heroicons/react/24/outline';
import Pagination from '@/components/Pagination';

interface Turf { id: number; name: string; }
interface Link { 
    id: number; 
    token: string;
    price: string; 
    expires_at: string; 
    date: string;
    start_time: string;
    end_time: string;
    status: string;
}

export default function BookingLinks() {
    const [turfs, setTurfs] = useState<Turf[]>([]);
    const [selectedTurf, setSelectedTurf] = useState('');
    const [links, setLinks] = useState<Link[]>([]);
    const [newLink, setNewLink] = useState({ 
        date: new Date().toISOString().split('T')[0], 
        startTime: '18:00', 
        endTime: '19:00', 
        price: '1000',
        expiresIn: '60'
    });

    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const itemsPerPage = 10;

    useEffect(() => {
        api.get('/turfs/owner/my').then(({ data }) => {
            const turfList = Array.isArray(data) ? data : data.data || [];
            setTurfs(turfList);
            if (turfList.length > 0) setSelectedTurf(turfList[0].id.toString());
        });
    }, []);

    const fetchLinks = useCallback(async () => {
        if (!selectedTurf) return;
        try {
            // Note: Currently backend doesn't support pagination for links list, but let's add it for future proofing
            const { data } = await api.get(`/booking-links?turf_id=${selectedTurf}`);
            setLinks(data);
            // setTotalPages(data.totalPages || 1); // If pagination is added to backend
        } catch { }
    }, [selectedTurf]);

    useEffect(() => {
        const load = async () => {
            await fetchLinks();
        };
        load();
    }, [fetchLinks]);

    const generateLink = async () => {
        try {
            await api.post(`/booking-links`, {
                turf_id: selectedTurf,
                date: newLink.date,
                start_time: newLink.startTime,
                end_time: newLink.endTime,
                price: newLink.price,
                expires_in_minutes: parseInt(newLink.expiresIn)
            });
            toast.success('Smart Link generated!');
            fetchLinks();
        } catch (err: unknown) {
            const error = err as { response?: { data?: { message?: string } } };
            toast.error(error.response?.data?.message || 'Failed to generate link');
        }
    };

    const copyLink = (token: string) => {
        const url = `${window.location.origin}/book-link/${token}`;
        navigator.clipboard.writeText(url);
        toast.success('Link copied to dashboard!');
    };

    return (
        <div className="animate-fade-in grid lg:grid-cols-4 gap-8">
            <div className="lg:col-span-1 space-y-4">
                <div className="glass-card p-6 border-l-4 border-blue-500">
                    <h3 className="text-sm font-bold text-white mb-6">Create Smart Link</h3>
                    <div className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Facility</label>
                            <select className="input-field" value={selectedTurf} onChange={e => setSelectedTurf(e.target.value)}>
                                {turfs.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Date</label>
                            <input type="date" className="input-field" value={newLink.date} onChange={e => setNewLink({...newLink, date: e.target.value})} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Start</label>
                                <input type="time" className="input-field" value={newLink.startTime} onChange={e => setNewLink({...newLink, startTime: e.target.value})} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">End</label>
                                <input type="time" className="input-field" value={newLink.endTime} onChange={e => setNewLink({...newLink, endTime: e.target.value})} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Price (₹)</label>
                                <input type="number" className="input-field" value={newLink.price} onChange={e => setNewLink({...newLink, price: e.target.value})} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Expires (Min)</label>
                                <input type="number" className="input-field" value={newLink.expiresIn} onChange={e => setNewLink({...newLink, expiresIn: e.target.value})} />
                            </div>
                        </div>
                        <button onClick={generateLink} className="btn-primary w-full justify-center py-4">Generate Link</button>
                    </div>
                </div>
            </div>

            <div className="lg:col-span-3 space-y-4">
                <div className="glass-card overflow-hidden">
                    <div className="p-6 border-b border-white/5 flex items-center justify-between">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2"><LinkIcon className="w-4 h-4 text-green-400" /> Active Smart Links</h3>
                    </div>
                    <div className="table-responsive">
                        <table className="modern-table">
                            <thead>
                                <tr>
                                    <th>SCHEDULE</th>
                                    <th>FINANCIALS</th>
                                    <th>STATUS</th>
                                    <th>ACTION</th>
                                </tr>
                            </thead>
                            <tbody>
                                {links.map(l => (
                                    <tr key={l.id} className="hover:bg-white/5 transition-colors">
                                        <td>
                                            <div className="font-black text-white">{new Date(l.date).toLocaleDateString()}</div>
                                            <div className="text-[10px] text-blue-400 font-bold uppercase">{l.start_time.slice(0, 5)} - {l.end_time.slice(0, 5)}</div>
                                        </td>
                                        <td>
                                            <div className="font-black text-white">₹{l.price}</div>
                                            <div className="text-[10px] text-slate-500 font-bold uppercase">Exp: {new Date(l.expires_at).toLocaleString()}</div>
                                        </td>
                                        <td>
                                            <div className={`badge ${l.status === 'active' ? 'badge-green' : l.status === 'used' ? 'badge-blue' : 'badge-red'}`}>
                                                {l.status.toUpperCase()}
                                            </div>
                                        </td>
                                        <td>
                                            <button 
                                                onClick={() => copyLink(l.token)} 
                                                className="p-2.5 hover:bg-white/10 text-slate-300 rounded-xl transition-all border border-white/5 hover:border-white/20"
                                                title="Copy Link"
                                            >
                                                <ShareIcon className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {links.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="text-center py-12 text-slate-500">No smart links found for this turf.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    {/* Pagination will be useful once we update backend */}
                    {totalPages > 1 && (
                        <Pagination 
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageChange={setCurrentPage}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
