'use client';
import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface Plan {
    id: number; code: string; name: string; tier: 'starter' | 'pro'; billing_interval: 'month' | 'year';
    price: number; max_turfs: number | null; allow_booking_links: number; is_active: number; sort_order: number;
}

const errMsg = (e: unknown, fallback: string) =>
    (e as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

export default function AdminPlans() {
    const [plans, setPlans] = useState<Plan[]>([]);
    const [edits, setEdits] = useState<Record<number, Partial<Plan>>>({});
    const [trialDays, setTrialDays] = useState('14');
    const [trialPlan, setTrialPlan] = useState('pro_monthly');

    const load = useCallback(async () => {
        try {
            const { data } = await api.get('/admin/plans');
            setPlans(data.plans);
            setTrialDays(data.trial?.trial_days ?? '14');
            setTrialPlan(data.trial?.trial_plan_code ?? 'pro_monthly');
            setEdits({});
        } catch (e) { toast.error(errMsg(e, 'Could not load plans')); }
    }, []);

    useEffect(() => { load(); }, [load]);

    const val = <K extends keyof Plan>(p: Plan, k: K): Plan[K] => (edits[p.id]?.[k] ?? p[k]) as Plan[K];
    const set = (id: number, patch: Partial<Plan>) => setEdits(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));

    const save = async (p: Plan) => {
        const patch = edits[p.id];
        if (!patch) return;
        try {
            await api.patch(`/admin/plans/${p.id}`, patch);
            toast.success(`${p.name} saved`);
            load();
        } catch (e) { toast.error(errMsg(e, 'Save failed')); }
    };

    const saveTrial = async () => {
        try {
            await api.patch('/admin/trial', { trial_days: Number(trialDays), trial_plan_code: trialPlan });
            toast.success('Trial settings saved');
        } catch (e) { toast.error(errMsg(e, 'Save failed')); }
    };

    return (
        <div className="animate-fade-in space-y-8">
            <div className="glass-card overflow-hidden">
                <div className="p-8 border-b border-white/5 bg-white/5">
                    <h3 className="text-sm font-black text-white uppercase tracking-widest">Subscription Plans</h3>
                    <p className="text-[10px] text-slate-500 font-bold mt-1">Price changes apply to new purchases only. Leave max turfs empty for unlimited.</p>
                </div>
                <div className="table-responsive">
                    <table className="modern-table">
                        <thead>
                            <tr><th>PLAN</th><th>TIER</th><th>BILLING</th><th>PRICE (₹)</th><th>MAX TURFS</th><th>BOOKING LINKS</th><th>ACTIVE</th><th></th></tr>
                        </thead>
                        <tbody>
                            {plans.map(p => (
                                <tr key={p.id} className="hover:bg-white/5">
                                    <td>
                                        <input className="input-field w-40" value={val(p, 'name')} onChange={e => set(p.id, { name: e.target.value })} />
                                        <div className="text-[10px] text-slate-500 mt-1">{p.code}</div>
                                    </td>
                                    <td className="text-xs text-slate-300 uppercase">{p.tier}</td>
                                    <td className="text-xs text-slate-300">{p.billing_interval === 'year' ? 'Annual' : 'Monthly'}</td>
                                    <td><input type="number" min={1} className="input-field w-28" value={val(p, 'price')} onChange={e => set(p.id, { price: Number(e.target.value) })} /></td>
                                    <td><input type="number" min={1} className="input-field w-20" value={val(p, 'max_turfs') ?? ''} onChange={e => set(p.id, { max_turfs: e.target.value === '' ? null : Number(e.target.value) })} /></td>
                                    <td><input type="checkbox" checked={!!val(p, 'allow_booking_links')} onChange={e => set(p.id, { allow_booking_links: e.target.checked ? 1 : 0 })} /></td>
                                    <td><input type="checkbox" checked={!!val(p, 'is_active')} onChange={e => set(p.id, { is_active: e.target.checked ? 1 : 0 })} /></td>
                                    <td><button onClick={() => save(p)} disabled={!edits[p.id]} className="btn-primary disabled:opacity-40">Save</button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="glass-card p-8 space-y-4">
                <h3 className="text-sm font-black text-white uppercase tracking-widest">Free Trial</h3>
                <p className="text-xs text-slate-400">Each owner can use one trial, only before their first paid plan. Set days to 0 to turn trials off.</p>
                <div className="flex flex-wrap items-end gap-4">
                    <label className="text-xs text-slate-400">Days
                        <input type="number" min={0} max={90} className="input-field w-24 block mt-1" value={trialDays} onChange={e => setTrialDays(e.target.value)} />
                    </label>
                    <label className="text-xs text-slate-400">Trial plan
                        <select className="input-field block mt-1" value={trialPlan} onChange={e => setTrialPlan(e.target.value)}>
                            {plans.map(p => <option key={p.code} value={p.code}>{p.name}</option>)}
                        </select>
                    </label>
                    <button onClick={saveTrial} className="btn-primary">Save trial settings</button>
                </div>
            </div>
        </div>
    );
}
