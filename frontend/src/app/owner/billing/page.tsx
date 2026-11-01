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

interface Plan {
    id: number; code: string; name: string; tier: 'starter' | 'pro'; billing_interval: 'month' | 'year';
    price: number; max_turfs: number | null; allow_booking_links: number;
}
interface SubStatus {
    is_subscribed: boolean;
    subscription: (Plan & { plan_name: string; plan_id: number | null; is_trial: number; start_date: string; end_date: string }) | null;
    usage: { turfs_used: number; max_turfs: number | null };
    trial: { eligible: boolean; days: number; plan_code: string };
    upcoming: { id: number; plan_name: string; start_date: string; end_date: string }[];
}
interface RouteStatus { settlement_mode: string; linked: boolean; status: string | null; can_receive_payments: boolean }

const inr = (n: number) => `₹${Number(n).toLocaleString('en-IN')}`;
const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const errMsg = (e: unknown, fallback: string) =>
    (e as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

export default function OwnerBilling() {
    const [billing, setBilling] = useState<BillingData | null>(null);
    const [plans, setPlans] = useState<Plan[]>([]);
    const [sub, setSub] = useState<SubStatus | null>(null);
    const [route, setRoute] = useState<RouteStatus | null>(null);
    const [billingInterval, setBillingInterval] = useState<'month' | 'year'>('month');
    const [busy, setBusy] = useState<string | null>(null);
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

    const fetchPlans = useCallback(async () => {
        try {
            const [p, s, r] = await Promise.all([
                api.get('/subscriptions/plans'),
                api.get('/subscriptions/status'),
                api.get('/owner/route-status').catch(() => ({ data: null })),
            ]);
            setPlans(p.data);
            setSub(s.data);
            setRoute(r.data);
            if (s.data?.subscription?.billing_interval === 'year') setBillingInterval('year');
        } catch { }
    }, []);

    useEffect(() => {
        const load = async () => {
            await Promise.all([fetchBilling(), fetchPlans()]);
        };
        load();
    }, [fetchBilling, fetchPlans]);

    const refreshAll = () => { fetchBilling(); fetchPlans(); };

    const handleTrial = async () => {
        setBusy('trial');
        try {
            const { data } = await api.post('/subscriptions/trial');
            toast.success(data.message);
            refreshAll();
        } catch (e) {
            toast.error(errMsg(e, 'Could not start trial'));
        } finally { setBusy(null); }
    };

    const handleSubscribe = async (plan: Plan) => {
        setBusy(plan.code);
        try {
            const { data } = await api.post('/subscriptions/subscribe', { plan_id: plan.id });
            const options = {
                key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
                amount: data.amount,
                currency: 'INR',
                name: 'Turf Booking',
                description: `${plan.name} subscription`,
                order_id: data.id,
                handler: async (res: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
                    try {
                        const { data: v } = await api.post('/subscriptions/verify', res);
                        toast.success(v.message || 'Subscription activated!');
                    } catch (e) {
                        toast.error(errMsg(e, 'Payment received but activation is pending. Refresh in a minute.'));
                    }
                    refreshAll();
                },
                modal: { ondismiss: () => setBusy(null) },
            };
            const rzp = new (window as unknown as { Razorpay: new (o: unknown) => { open: () => void } }).Razorpay(options);
            rzp.open();
        } catch (e) {
            toast.error(errMsg(e, 'Could not start payment'));
            setBusy(null);
        }
    };

    if (!billing) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-green-400" /></div>;

    const currentTransactions = billing.transactions.data;

    return (
        <div className="animate-fade-in space-y-8">
            {route && route.settlement_mode === 'route' && !route.linked && (
                <div className="glass-card p-4 border border-yellow-500/30 text-sm text-yellow-300">
                    Customers can&apos;t pay online for your turfs yet. Add your bank account in <a href="/owner/profile" className="underline font-bold">Profile → Bank details</a> so booking payments reach you instantly.
                </div>
            )}
            {route?.linked && route.status && route.status !== 'verified' && route.status !== 'activated' && (
                <div className="glass-card p-4 border border-blue-500/30 text-sm text-blue-300">
                    Bank account linked — Razorpay verification status: <b>{route.status}</b>. This usually takes about 15 minutes.
                </div>
            )}

            <div className="glass-card p-6 space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Current Plan</p>
                        {sub?.subscription ? (
                            <>
                                <h4 className="text-xl font-black text-white">{sub.subscription.plan_name}</h4>
                                <p className="text-xs text-slate-400 mt-1">
                                    {sub.subscription.is_trial ? 'Free trial ends' : 'Valid until'} {fmtDate(sub.subscription.end_date)}
                                    {' · '}Turfs {sub.usage.turfs_used}/{sub.usage.max_turfs ?? '∞'}
                                    {' · '}Booking links {sub.subscription.allow_booking_links ? 'included' : 'not included'}
                                </p>
                                {sub.upcoming.map(u => (
                                    <p key={u.id} className="text-xs text-green-400 mt-1">Next: {u.plan_name} from {fmtDate(u.start_date)} to {fmtDate(u.end_date)}</p>
                                ))}
                            </>
                        ) : (
                            <>
                                <h4 className="text-xl font-black text-white">No active plan</h4>
                                <p className="text-xs text-red-400 mt-1">Your turfs are hidden from customers until you subscribe.</p>
                            </>
                        )}
                    </div>
                    <div className="flex bg-white/5 rounded-xl p-1 text-xs font-bold">
                        <button onClick={() => setBillingInterval('month')} className={`px-4 py-2 rounded-lg ${billingInterval === 'month' ? 'bg-green-500 text-black' : 'text-slate-400'}`}>Monthly</button>
                        <button onClick={() => setBillingInterval('year')} className={`px-4 py-2 rounded-lg ${billingInterval === 'year' ? 'bg-green-500 text-black' : 'text-slate-400'}`}>Annual · save ~2 months</button>
                    </div>
                </div>

                {sub?.trial.eligible && (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-green-500/30 bg-green-500/5 p-4">
                        <p className="text-sm text-green-300">Try Pro free for {sub.trial.days} days — no payment needed.</p>
                        <button onClick={handleTrial} disabled={busy !== null} className="btn-primary">{busy === 'trial' ? 'Starting…' : 'Start free trial'}</button>
                    </div>
                )}

                <div className="grid md:grid-cols-2 gap-4">
                    {plans.filter(p => p.billing_interval === billingInterval).map(p => {
                        const monthly = plans.find(m => m.tier === p.tier && m.billing_interval === 'month');
                        const saving = p.billing_interval === 'year' && monthly ? monthly.price * 12 - p.price : 0;
                        const isCurrent = !!sub?.subscription && !sub.subscription.is_trial && sub.subscription.plan_id === p.id;
                        const tooSmall = p.max_turfs != null && (sub?.usage.turfs_used ?? 0) > p.max_turfs;
                        return (
                            <div key={p.id} className={`rounded-2xl border p-5 ${p.tier === 'pro' ? 'border-green-500/40' : 'border-white/10'}`}>
                                <div className="flex items-center justify-between">
                                    <h5 className="text-lg font-black text-white">{p.name}</h5>
                                    {p.tier === 'pro' && <span className="badge badge-green">Popular</span>}
                                </div>
                                <p className="mt-2 text-3xl font-black text-white">{inr(p.price)}<span className="text-sm text-slate-400 font-medium">/{p.billing_interval === 'year' ? 'year' : 'month'}</span></p>
                                {saving > 0 && <p className="text-xs text-green-400 mt-1">Save {inr(saving)} vs monthly</p>}
                                <ul className="mt-4 space-y-1 text-sm text-slate-300">
                                    <li>• {p.max_turfs == null ? 'Unlimited turfs' : `Up to ${p.max_turfs} turf${p.max_turfs === 1 ? '' : 's'}`}</li>
                                    <li>• Slots, pricing rules and online payments</li>
                                    <li>• {p.allow_booking_links ? 'Private booking links' : 'No private booking links'}</li>
                                </ul>
                                <button
                                    onClick={() => handleSubscribe(p)}
                                    disabled={busy !== null || tooSmall}
                                    className="btn-primary w-full justify-center mt-5 disabled:opacity-40"
                                    title={tooSmall ? `You have more than ${p.max_turfs} turfs` : undefined}
                                >
                                    {busy === p.code ? 'Opening payment…' : tooSmall ? 'Too many turfs for this plan' : isCurrent ? 'Renew' : sub?.subscription && !sub.subscription.is_trial ? 'Switch to this plan' : 'Subscribe'}
                                </button>
                            </div>
                        );
                    })}
                </div>
                <p className="text-[11px] text-slate-500">Upgrading to Pro starts immediately. Renewing or moving to Starter starts when your current period ends. Plans don&apos;t auto-renew yet, so renew here before your end date.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
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
