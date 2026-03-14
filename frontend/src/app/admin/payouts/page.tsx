'use client';
import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { WalletIcon } from '@heroicons/react/24/outline';

import Pagination from '@/components/Pagination';

interface PendingPayout { owner_id: number; owner_name: string; total_pending: number; last_payout_date: string; }

export default function AdminPayouts() {
    const [pending, setPending] = useState<PendingPayout[]>([]);
    const [form, setForm] = useState({ commission: '0', min_payout: '0', freq: 'weekly' });
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const itemsPerPage = 10;

    const fetchData = useCallback(async () => {
        try {
            const { data: response } = await api.get(`/payouts/admin/pending?page=${currentPage}&limit=${itemsPerPage}`);
            if (response.data) {
                setPending(response.data);
                setTotalPages(response.totalPages);
            } else {
                setPending(response);
            }
        } catch { }
    }, [currentPage, itemsPerPage]);

    useEffect(() => {
        const load = async () => {
            await fetchData();
        };
        load();
    }, [fetchData]);

    const currentData = pending;

    const updateSettings = async () => {
        try {
            await api.post('/admin/payout-settings', { commission_percentage: form.commission, minimum_payout_amount: form.min_payout, payout_frequency: form.freq });
            toast.success('Monetary protocols updated');
            fetchData();
        } catch { }
    };

    const processPayout = async (ownerId: number, amount: number) => {
        try {
            const ref = `PAY-${new Date().getTime()}`;
            await api.post('/payouts/admin/process', { owner_id: ownerId, amount, transaction_ref: ref });
            toast.success('Payout dispatch successful');
            fetchData();
        } catch { }
    };

    return (
        <div className="animate-fade-in grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 lg:border-r border-white/5 lg:pr-8 space-y-8 border-b lg:border-b-0 pb-8 lg:pb-0">
                <div className="glass-card p-8 border-l-4 border-emerald-500">
                    <h3 className="text-sm font-black text-white uppercase tracking-widest mb-8">Payout Protocols</h3>
                    <div className="space-y-6">
                        <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] ml-1">Platform Tax (%)</label><input type="number" className="input-field" value={form.commission} onChange={e => setForm({...form, commission: e.target.value})} /></div>
                        <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] ml-1">Min Threshold (₹)</label><input type="number" className="input-field" value={form.min_payout} onChange={e => setForm({...form, min_payout: e.target.value})} /></div>
                        <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] ml-1">Dispatch Cycle</label><select className="input-field" value={form.freq} onChange={e => setForm({...form, freq: e.target.value})}><option value="weekly">Weekly Rotation</option><option value="monthly">Monthly Cycle</option></select></div>
                        <button onClick={updateSettings} className="btn-primary w-full justify-center py-4 font-bold shadow-emerald-500/20">Update Protocols</button>
                    </div>
                </div>
            </div>

            <div className="lg:col-span-2 space-y-8 overflow-hidden">
                <div className="glass-card overflow-hidden">
                    <div className="p-8 border-b border-white/5 bg-white/5 flex items-center justify-between">
                        <div>
                            <h3 className="text-sm font-black text-white uppercase tracking-widest">Pending Settlements</h3>
                            <p className="text-[10px] text-slate-500 font-bold mt-1">Authorized fund transfers to operators</p>
                        </div>
                    </div>
                    <div className="table-responsive">
                        <table className="modern-table">
                            <thead>
                                <tr>
                                    <th>OPERATOR</th>
                                    <th>LIQUIDITY</th>
                                    <th>LAST SYNC</th>
                                    <th>ACTION</th>
                                </tr>
                            </thead>
                            <tbody>
                                {currentData.length === 0 ? (
                                    <tr><td colSpan={4} className="text-center py-10 text-slate-500 font-bold uppercase tracking-widest">No pending transfers detected</td></tr>
                                ) : (
                                    currentData.map(p => (
                                        <tr key={p.owner_id} className="hover:bg-white/5">
                                            <td className="font-black text-white uppercase">{p.owner_name}</td>
                                            <td>
                                                <div className="flex items-center gap-2 font-black text-emerald-400">
                                                    <WalletIcon className="w-4 h-4" /> ₹{p.total_pending.toLocaleString()}
                                                </div>
                                            </td>
                                            <td className="text-xs text-slate-400 font-medium">{p.last_payout_date || 'INITIAL'}</td>
                                            <td>
                                                <button onClick={() => processPayout(p.owner_id, p.total_pending)} className="px-4 py-2 bg-emerald-500 text-[#050510] font-black text-[10px] uppercase rounded-lg hover:bg-emerald-400 transition-all tracking-widest">Authorize Transfer</button>
                                            </td>
                                        </tr>
                                    ))
                                )}
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
        </div>
    );
}
