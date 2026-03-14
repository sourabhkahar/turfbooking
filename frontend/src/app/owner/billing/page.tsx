'use client';
import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { CreditCardIcon, CurrencyRupeeIcon, ArrowUpCircleIcon, CheckBadgeIcon } from '@heroicons/react/24/outline';

import Pagination from '@/components/Pagination';

interface BillingData {
    subscription: { status: string; next_billing_at: string; plan_name: string; };
    stats: { total_revenue: number; pending_payout: number; next_payout_date: string; };
    transactions: {
        data: { id: number; amount: number; type: string; status: string; created_at: string; }[];
        totalPages: number;
        total: number;
    };
}

export default function OwnerBilling() {
    const [billing, setBilling] = useState<BillingData | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const itemsPerPage = 10;

    const fetchBilling = useCallback(async () => {
        try {
            const { data } = await api.get(`/owner/billing?page=${currentPage}&limit=${itemsPerPage}`);
            setBilling(data);
            setTotalPages(data.transactions.totalPages || 1);
        } catch { }
    }, [currentPage, itemsPerPage]);

    useEffect(() => {
        const load = async () => {
            await fetchBilling();
        };
        load();
    }, [fetchBilling]);

    const handleSubscribe = async () => {
        try {
            const { data } = await api.post('/subscriptions/subscribe');
            const options = {
                key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
                amount: data.amount,
                currency: "INR",
                name: "TurfPro Subscription",
                order_id: data.id,
                handler: async (res: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
                    await api.post('/subscriptions/verify', res);
                    toast.success('Subscription activated!');
                    fetchBilling();
                }
            };
            const rzp = new (window as unknown as { Razorpay: any }).Razorpay(options);
            rzp.open();
        } catch { }
    };

    if (!billing) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-green-400" /></div>;

    const currentTransactions = billing.transactions.data;

    return (
        <div className="animate-fade-in space-y-8">
            <div className="grid md:grid-cols-3 gap-6">
                <div className="glass-card p-6 border-b-4 border-green-500">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-green-500/10 rounded-2xl"><CheckBadgeIcon className="w-6 h-6 text-green-400" /></div>
                        <span className={`badge ${billing.subscription.status === 'active' ? 'badge-green' : 'badge-red'}`}>{billing.subscription.status}</span>
                    </div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Current Plan</p>
                    <h4 className="text-xl font-black text-white mb-4">{billing.subscription.plan_name}</h4>
                    {billing.subscription.status !== 'active' ? (
                        <button onClick={handleSubscribe} className="btn-primary w-full justify-center">Activate Plan</button>
                    ) : (
                        <p className="text-xs text-slate-400">Renews: {new Date(billing.subscription.next_billing_at).toLocaleDateString()}</p>
                    )}
                </div>

                <div className="glass-card p-6 border-b-4 border-blue-500">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-blue-500/10 rounded-2xl"><CurrencyRupeeIcon className="w-6 h-6 text-blue-400" /></div>
                    </div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Available Payout</p>
                    <h4 className="text-2xl font-black text-white">₹{billing.stats.pending_payout.toLocaleString()}</h4>
                    <p className="text-xs text-slate-400 mt-2">Next Scheduled: {billing.stats.next_payout_date || 'TBD'}</p>
                </div>

                <div className="glass-card p-6 border-b-4 border-purple-500">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-purple-500/10 rounded-2xl"><ArrowUpCircleIcon className="w-6 h-6 text-purple-400" /></div>
                    </div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Life-time Earnings</p>
                    <h4 className="text-2xl font-black text-white">₹{billing.stats.total_revenue.toLocaleString()}</h4>
                    <p className="text-xs text-slate-400 mt-2">Total platform revenue generated</p>
                </div>
            </div>

            <div className="glass-card overflow-hidden">
                <div className="p-6 border-b border-white/5 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2"><CreditCardIcon className="w-4 h-4 text-slate-400" /> Transaction Stream</h3>
                </div>
                <div className="table-responsive">
                    <table className="modern-table">
                        <thead>
                            <tr>
                                <th>REFERENCE</th>
                                <th>TYPE</th>
                                <th>AMOUNT</th>
                                <th>DATE</th>
                                <th>STATUS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {currentTransactions.map(t => (
                                <tr key={t.id} className="hover:bg-white/5">
                                    <td className="font-bold text-white">#TXN-{t.id}</td>
                                    <td><span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t.type}</span></td>
                                    <td className="font-black text-white">₹{t.amount}</td>
                                    <td className="text-xs text-slate-400 font-medium">{new Date(t.created_at).toLocaleDateString()}</td>
                                    <td><span className={`badge ${t.status === 'completed' || t.status === 'active' ? 'badge-green' : 'badge-yellow'}`}>{t.status}</span></td>
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
