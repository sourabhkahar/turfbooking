'use client';
import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
    WalletIcon, BanknotesIcon, CheckCircleIcon,
    XCircleIcon, ClockIcon, ArrowPathIcon,
    BuildingLibraryIcon, DocumentTextIcon, DevicePhoneMobileIcon
} from '@heroicons/react/24/outline';
import Pagination from '@/components/Pagination';

interface PendingPayout {
    owner_id: number;
    owner_name: string;
    owner_email: string;
    owner_phone: string;
    bank_account_number: string | null;
    ifsc_code: string | null;
    pan: string | null;
    upi_id: string | null;
    booking_count: number;
    gross_amount: number;
    platform_fee: number;
    total_pending: number;
    last_payout_date: string | null;
}

interface PayoutHistory {
    id: number;
    owner_id: number;
    owner_name: string;
    owner_email: string;
    amount: number;
    platform_fee: number;
    final_amount: number;
    status: 'pending' | 'processed' | 'failed';
    payout_mode: string;
    razorpay_payout_id: string | null;
    transaction_ref: string;
    processed_at: string;
    failure_reason: string | null;
}

function BankBadge({ hasBanking }: { hasBanking: boolean }) {
    return hasBanking ? (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] font-black uppercase tracking-wider">
            <CheckCircleIcon className="w-3 h-3" /> Verified
        </span>
    ) : (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 text-[10px] font-black uppercase tracking-wider">
            <XCircleIcon className="w-3 h-3" /> No Bank
        </span>
    );
}

function StatusBadge({ status }: { status: string }) {
    const map: Record<string, string> = {
        processed: 'bg-emerald-500/15 text-emerald-400',
        pending: 'bg-amber-500/15 text-amber-400',
        failed: 'bg-red-500/15 text-red-400',
    };
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${map[status] || 'bg-slate-500/15 text-slate-400'}`}>
            {status === 'processed' && <CheckCircleIcon className="w-3 h-3" />}
            {status === 'pending' && <ClockIcon className="w-3 h-3" />}
            {status === 'failed' && <XCircleIcon className="w-3 h-3" />}
            {status}
        </span>
    );
}

function maskAccount(acc: string | null) {
    if (!acc) return '—';
    if (acc.length <= 4) return acc;
    return '•'.repeat(acc.length - 4) + acc.slice(-4);
}

export default function AdminPayouts() {
    const [tab, setTab] = useState<'pending' | 'history'>('pending');
    const [pending, setPending] = useState<PendingPayout[]>([]);
    const [history, setHistory] = useState<PayoutHistory[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [historyPage, setHistoryPage] = useState(1);
    const [historyTotalPages, setHistoryTotalPages] = useState(1);
    const [processingId, setProcessingId] = useState<number | null>(null);
    const [bulkLoading, setBulkLoading] = useState(false);
    const [selectedOwner, setSelectedOwner] = useState<PendingPayout | null>(null);
    const itemsPerPage = 10;

    const fetchPending = useCallback(async () => {
        try {
            const { data: response } = await api.get(`/payouts/admin/pending?page=${currentPage}&limit=${itemsPerPage}`);
            setPending(response.data || []);
            setTotalPages(response.totalPages || 1);
        } catch { }
    }, [currentPage]);

    const fetchHistory = useCallback(async () => {
        try {
            const { data: response } = await api.get(`/payouts/admin/history?page=${historyPage}&limit=20`);
            setHistory(response.data || []);
            setHistoryTotalPages(response.totalPages || 1);
        } catch { }
    }, [historyPage]);

    useEffect(() => { fetchPending(); }, [fetchPending]);
    useEffect(() => { if (tab === 'history') fetchHistory(); }, [tab, fetchHistory]);

    const processPayout = async (owner: PendingPayout, mode: 'bank_account' | 'upi') => {
        // Validate
        if (mode === 'bank_account' && (!owner.bank_account_number || !owner.ifsc_code)) {
            return toast.error(`${owner.owner_name} has not filled bank account details`);
        }
        if (mode === 'upi' && !owner.upi_id) {
            return toast.error(`${owner.owner_name} has no UPI ID on record`);
        }

        setProcessingId(owner.owner_id);
        try {
            const { data } = await api.post('/payouts/admin/process', {
                owner_id: owner.owner_id,
                mode
            });
            toast.success(
                `✅ ₹${data.amount?.toLocaleString()} transferred to ${owner.owner_name}`,
                { duration: 5000 }
            );
            setSelectedOwner(null);
            fetchPending();
        } catch (err: unknown) {
            const error = err as { response?: { data?: { message?: string; failure_reason?: string } } };
            toast.error(error.response?.data?.failure_reason || error.response?.data?.message || 'Payout failed');
        } finally {
            setProcessingId(null);
        }
    };

    const processAllPayouts = async () => {
        setBulkLoading(true);
        try {
            const { data } = await api.post('/payouts/admin/process-all');
            toast.success(data.message || 'Bulk payout complete', { duration: 6000 });
            fetchPending();
        } catch (err: unknown) {
            const error = err as { response?: { data?: { message?: string } } };
            toast.error(error.response?.data?.message || 'Bulk payout failed');
        } finally {
            setBulkLoading(false);
        }
    };

    const ownersWithBanking = pending.filter(p => p.bank_account_number && p.ifsc_code);
    const ownersWithoutBanking = pending.filter(p => !p.bank_account_number || !p.ifsc_code);
    const totalPendingAmount = pending.reduce((a, b) => a + (b.total_pending || 0), 0);

    return (
        <div className="animate-fade-in space-y-8">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="glass-card p-5 border-l-4 border-emerald-500">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Total Pending</p>
                    <p className="text-2xl font-black text-emerald-400">₹{totalPendingAmount.toLocaleString()}</p>
                    <p className="text-[10px] text-slate-500 mt-1">{pending.length} owner(s) awaiting payout</p>
                </div>
                <div className="glass-card p-5 border-l-4 border-blue-500">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Ready to Pay</p>
                    <p className="text-2xl font-black text-blue-400">{ownersWithBanking.length}</p>
                    <p className="text-[10px] text-slate-500 mt-1">Owners with bank details verified</p>
                </div>
                <div className="glass-card p-5 border-l-4 border-amber-500">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Incomplete</p>
                    <p className="text-2xl font-black text-amber-400">{ownersWithoutBanking.length}</p>
                    <p className="text-[10px] text-slate-500 mt-1">Owners missing bank details</p>
                </div>
            </div>

            {/* Tabs + Bulk Action */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex gap-2 bg-white/5 rounded-xl p-1">
                    {[{ id: 'pending', label: `Pending (${pending.length})` }, { id: 'history', label: 'Payout History' }].map(t => (
                        <button key={t.id} onClick={() => setTab(t.id as 'pending' | 'history')}
                            className={`px-5 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${tab === t.id ? 'bg-emerald-500 text-[#050510]' : 'text-slate-400 hover:text-white'}`}>
                            {t.label}
                        </button>
                    ))}
                </div>
                {tab === 'pending' && ownersWithBanking.length > 0 && (
                    <button onClick={processAllPayouts} disabled={bulkLoading}
                        className="flex items-center gap-2 px-5 py-2 bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-black text-xs uppercase tracking-widest rounded-xl hover:bg-emerald-500/30 transition-all disabled:opacity-50">
                        {bulkLoading ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <BanknotesIcon className="w-4 h-4" />}
                        {bulkLoading ? 'Processing...' : `Pay All ${ownersWithBanking.length} Owners`}
                    </button>
                )}
            </div>

            {/* PENDING TAB */}
            {tab === 'pending' && (
                <div className="glass-card overflow-hidden">
                    <div className="p-6 border-b border-white/5 bg-white/5">
                        <h3 className="text-sm font-black text-white uppercase tracking-widest">Pending Settlements</h3>
                        <p className="text-[10px] text-slate-500 font-bold mt-1">Click &quot;Transfer&quot; to initiate direct bank transfer via Razorpay</p>
                    </div>

                    {pending.length === 0 ? (
                        <div className="py-16 text-center">
                            <WalletIcon className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                            <p className="text-slate-500 font-bold uppercase tracking-widest text-sm">No pending payouts</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-white/5">
                            {pending.map(owner => (
                                <div key={owner.owner_id} className={`p-6 hover:bg-white/3 transition-all ${selectedOwner?.owner_id === owner.owner_id ? 'bg-white/5' : ''}`}>
                                    <div className="flex items-start justify-between gap-4 flex-wrap">
                                        {/* Owner Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-3 mb-2">
                                                <p className="font-black text-white uppercase text-sm truncate">{owner.owner_name}</p>
                                                <BankBadge hasBanking={!!(owner.bank_account_number && owner.ifsc_code)} />
                                            </div>
                                            <p className="text-xs text-slate-400">{owner.owner_email}</p>

                                            {/* Banking Details Row */}
                                            <div className="flex items-center gap-4 mt-3 flex-wrap">
                                                <div className="flex items-center gap-1.5">
                                                    <BuildingLibraryIcon className="w-3.5 h-3.5 text-slate-500" />
                                                    <span className="text-[11px] text-slate-400 font-mono">
                                                        {owner.bank_account_number ? maskAccount(owner.bank_account_number) : <span className="text-red-400/70">No account</span>}
                                                    </span>
                                                </div>
                                                {owner.ifsc_code && (
                                                    <div className="flex items-center gap-1.5">
                                                        <DocumentTextIcon className="w-3.5 h-3.5 text-slate-500" />
                                                        <span className="text-[11px] text-slate-400 font-mono">{owner.ifsc_code}</span>
                                                    </div>
                                                )}
                                                {owner.upi_id && (
                                                    <div className="flex items-center gap-1.5">
                                                        <DevicePhoneMobileIcon className="w-3.5 h-3.5 text-slate-500" />
                                                        <span className="text-[11px] text-slate-400">{owner.upi_id}</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Earnings Breakdown */}
                                            <div className="flex items-center gap-4 mt-3 flex-wrap">
                                                <div>
                                                    <p className="text-[9px] text-slate-500 uppercase tracking-widest">Gross</p>
                                                    <p className="text-sm font-black text-slate-300">₹{Number(owner.gross_amount || 0).toLocaleString()}</p>
                                                </div>
                                                <div className="text-slate-600">−</div>
                                                <div>
                                                    <p className="text-[9px] text-slate-500 uppercase tracking-widest">Platform Fee (2%)</p>
                                                    <p className="text-sm font-black text-red-400">₹{Number(owner.platform_fee || 0).toLocaleString()}</p>
                                                </div>
                                                <div className="text-slate-600">=</div>
                                                <div>
                                                    <p className="text-[9px] text-slate-500 uppercase tracking-widest">Net Transfer</p>
                                                    <p className="text-sm font-black text-emerald-400">₹{Number(owner.total_pending || 0).toLocaleString()}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[9px] text-slate-500 uppercase tracking-widest">Bookings</p>
                                                    <p className="text-sm font-black text-slate-300">{owner.booking_count}</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Action Panel */}
                                        <div className="flex flex-col gap-2 min-w-[160px]">
                                            {owner.bank_account_number && owner.ifsc_code && (
                                                <button
                                                    onClick={() => processPayout(owner, 'bank_account')}
                                                    disabled={processingId === owner.owner_id}
                                                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500 text-[#050510] font-black text-[10px] uppercase rounded-xl hover:bg-emerald-400 transition-all tracking-widest disabled:opacity-50 disabled:cursor-not-allowed">
                                                    {processingId === owner.owner_id
                                                        ? <ArrowPathIcon className="w-4 h-4 animate-spin" />
                                                        : <BuildingLibraryIcon className="w-4 h-4" />}
                                                    {processingId === owner.owner_id ? 'Transferring...' : 'Bank Transfer'}
                                                </button>
                                            )}
                                            {owner.upi_id && (
                                                <button
                                                    onClick={() => processPayout(owner, 'upi')}
                                                    disabled={processingId === owner.owner_id}
                                                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-500/20 border border-violet-500/40 text-violet-400 font-black text-[10px] uppercase rounded-xl hover:bg-violet-500/30 transition-all tracking-widest disabled:opacity-50">
                                                    <DevicePhoneMobileIcon className="w-4 h-4" />
                                                    UPI Transfer
                                                </button>
                                            )}
                                            {!owner.bank_account_number && !owner.upi_id && (
                                                <div className="px-4 py-2.5 bg-red-500/10 border border-red-500/20 text-red-400 font-black text-[9px] uppercase rounded-xl tracking-widest text-center">
                                                    No payment method
                                                </div>
                                            )}
                                            <p className="text-[9px] text-slate-600 text-center">
                                                {owner.last_payout_date
                                                    ? `Last: ${new Date(owner.last_payout_date).toLocaleDateString('en-IN')}`
                                                    : 'First payout'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="px-6 pb-4">
                        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
                    </div>
                </div>
            )}

            {/* HISTORY TAB */}
            {tab === 'history' && (
                <div className="glass-card overflow-hidden">
                    <div className="p-6 border-b border-white/5 bg-white/5">
                        <h3 className="text-sm font-black text-white uppercase tracking-widest">Payout History</h3>
                        <p className="text-[10px] text-slate-500 font-bold mt-1">All transfers processed via Razorpay</p>
                    </div>

                    {history.length === 0 ? (
                        <div className="py-16 text-center">
                            <ClockIcon className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                            <p className="text-slate-500 font-bold uppercase tracking-widest text-sm">No payout history yet</p>
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <table className="modern-table">
                                <thead>
                                    <tr>
                                        <th>OWNER</th>
                                        <th>GROSS</th>
                                        <th>FEE</th>
                                        <th>NET</th>
                                        <th>MODE</th>
                                        <th>RZP ID</th>
                                        <th>STATUS</th>
                                        <th>DATE</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {history.map(p => (
                                        <tr key={p.id} className="hover:bg-white/5">
                                            <td>
                                                <p className="font-black text-white text-xs uppercase">{p.owner_name}</p>
                                                <p className="text-[10px] text-slate-500">{p.owner_email}</p>
                                            </td>
                                            <td className="text-slate-300 font-black text-xs">₹{Number(p.amount).toLocaleString()}</td>
                                            <td className="text-red-400 font-black text-xs">₹{Number(p.platform_fee || 0).toLocaleString()}</td>
                                            <td className="text-emerald-400 font-black text-xs">₹{Number(p.final_amount).toLocaleString()}</td>
                                            <td>
                                                <span className="text-[10px] uppercase font-bold text-slate-400">
                                                    {p.payout_mode === 'upi' ? '📱 UPI' : '🏦 Bank'}
                                                </span>
                                            </td>
                                            <td>
                                                <span className="text-[10px] font-mono text-slate-500 truncate max-w-[100px] block">
                                                    {p.razorpay_payout_id || p.transaction_ref || '—'}
                                                </span>
                                            </td>
                                            <td><StatusBadge status={p.status} /></td>
                                            <td className="text-[10px] text-slate-400">
                                                {p.processed_at ? new Date(p.processed_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    <div className="px-6 pb-4">
                        <Pagination currentPage={historyPage} totalPages={historyTotalPages} onPageChange={setHistoryPage} />
                    </div>
                </div>
            )}
        </div>
    );
}
