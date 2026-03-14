'use client';
import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import {
    CreditCardIcon,
    BanknotesIcon,
    TableCellsIcon
} from '@heroicons/react/24/outline';

import Pagination from '@/components/Pagination';

interface Subscription { id: number; owner_name: string; plan_name: string; amount: number; status: string; created_at: string; }
interface Payout { id: number; owner_name: string; amount: number; status: string; processed_at: string; transaction_ref: string; }
interface BookingData { id: number; turf_name: string; total_price: number; paid_amount: number; platform_fee: number; created_at: string; }

export default function AdminFinancials() {
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
    const [payouts, setPayouts] = useState<Payout[]>([]);
    const [bookings, setBookings] = useState<BookingData[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('subscriptions');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const itemsPerPage = 10;

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const endpoint = `/financials/${activeTab}?page=${currentPage}&limit=${itemsPerPage}`;
            const { data: response } = await api.get(endpoint);
            
            if (activeTab === 'subscriptions') setSubscriptions(response.data);
            else if (activeTab === 'payouts') setPayouts(response.data);
            else if (activeTab === 'bookings') setBookings(response.data);
            
            setTotalPages(response.totalPages);
        } catch { } finally { setLoading(false); }
    }, [activeTab, currentPage, itemsPerPage]);

    useEffect(() => {
        const load = async () => {
            await fetchData();
        };
        load();
    }, [fetchData]);

    const tabs = [
        { id: 'subscriptions', name: 'Plan Revenue', icon: CreditCardIcon },
        { id: 'payouts', name: 'Network Payouts', icon: BanknotesIcon },
        { id: 'bookings', name: 'Transaction Stream', icon: TableCellsIcon },
    ];

    return (
        <div className="animate-fade-in space-y-10">
            {/* Tab Navigation */}
            <div className="flex flex-wrap gap-2 p-1.5 bg-white/5 backdrop-blur-xl rounded-2xl w-full sm:w-fit border border-white/5">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => {
                            setActiveTab(tab.id);
                            setCurrentPage(1);
                        }}
                        className={`flex-1 sm:flex-none flex items-center justify-center gap-3 px-4 sm:px-6 py-3 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-[0.15em] transition-all ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                    >
                        <tab.icon className="w-4 h-4" />
                        <span className="whitespace-nowrap">{tab.name}</span>
                    </button>
                ))}
            </div>

            {loading ? <div className="flex justify-center py-24"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-500" /></div> : (
            /* Content Area */
            <div className="glass-card overflow-hidden">
                <div className="table-responsive">
                    <table className="modern-table">
                        {activeTab === 'subscriptions' && (
                            <>
                                <thead>
                                    <tr>
                                        <th>OPERATOR</th>
                                        <th>PROTOCOL</th>
                                        <th>MAGNITUDE</th>
                                        <th>TIMESTAMP</th>
                                        <th>STATUS</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {subscriptions.map((s) => (
                                        <tr key={s.id} className="hover:bg-white/5">
                                            <td className="font-black text-white uppercase">{s.owner_name}</td>
                                            <td className="font-bold text-blue-400">{s.plan_name}</td>
                                            <td className="font-black text-white">₹{s.amount.toLocaleString()}</td>
                                            <td className="text-xs text-slate-400 font-medium">{new Date(s.created_at).toLocaleDateString()}</td>
                                            <td><span className={`badge ${s.status === 'active' || s.status === 'completed' ? 'badge-green' : 'badge-yellow'}`}>{s.status}</span></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </>
                        )}

                        {activeTab === 'payouts' && (
                            <>
                                <thead>
                                    <tr>
                                        <th>RECIPIENT</th>
                                        <th>REFERENCE</th>
                                        <th>LIQUIDITY</th>
                                        <th>AUTHORIZED</th>
                                        <th>LEDGER</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {payouts.map((p) => (
                                        <tr key={p.id} className="hover:bg-white/5">
                                            <td className="font-black text-white uppercase">{p.owner_name}</td>
                                            <td className="text-[10px] text-slate-500 font-bold uppercase">{p.transaction_ref}</td>
                                            <td className="font-black text-emerald-400">₹{p.amount.toLocaleString()}</td>
                                            <td className="text-xs text-slate-400 font-medium">{new Date(p.processed_at).toLocaleDateString()}</td>
                                            <td><span className="badge badge-green">DISPATCHED</span></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </>
                        )}

                        {activeTab === 'bookings' && (
                            <>
                                <thead>
                                    <tr>
                                        <th>INFRASTRUCTURE</th>
                                        <th>REVENUE</th>
                                        <th>PLATEFORM TAX</th>
                                        <th>NET VALUE</th>
                                        <th>TIMESTAMP</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {bookings.map((b) => (
                                        <tr key={b.id} className="hover:bg-white/5">
                                            <td className="font-black text-white uppercase">{b.turf_name}</td>
                                            <td className="font-bold text-slate-300">₹{b.total_price}</td>
                                            <td className="font-black text-blue-500">₹{b.platform_fee}</td>
                                            <td className="font-black text-emerald-400">₹{b.paid_amount}</td>
                                            <td className="text-xs text-slate-400 font-medium">{new Date(b.created_at).toLocaleDateString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </>
                        )}
                    </table>
                </div>
                <Pagination 
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                />
            </div>
            )}
        </div>
    );
}
