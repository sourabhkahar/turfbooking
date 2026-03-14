'use client';
import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { CurrencyRupeeIcon, CheckCircleIcon, SparklesIcon } from '@heroicons/react/24/outline';

interface Turf { id: number; name: string; base_price: number; }
interface PriceRule { id: number; day_of_week: string|null; start_date: string|null; end_date: string|null; multiplier: string; label: string; }

export default function Pricing() {
    const [turfs, setTurfs] = useState<Turf[]>([]);
    const [selectedTurf, setSelectedTurf] = useState('');
    const [rules, setRules] = useState<PriceRule[]>([]);
    const [basePrice, setBasePrice] = useState('0');
    const [newRule, setNewRule] = useState({ type: 'day', day: 'Saturday', multiplier: '1.2', label: 'Weekend Special' });

    useEffect(() => {
        api.get('/turfs/owner/my').then((res) => {
            const turfsData = res.data.data || res.data;
            const dataArray = Array.isArray(turfsData) ? turfsData : [];
            setTurfs(dataArray);
            if (dataArray.length > 0) {
                setSelectedTurf(dataArray[0].id.toString());
                setBasePrice(dataArray[0].base_price?.toString() || '0');
            }
        });
    }, []);

    const fetchRules = useCallback(async () => {
        if (!selectedTurf) return;
        try {
            const { data } = await api.get(`/pricing/rules/${selectedTurf}`);
            setRules(data);
        } catch (err: unknown) {
            console.error(err);
        }
    }, [selectedTurf]);

    useEffect(() => {
        const load = async () => {
            await fetchRules();
        };
        load();
    }, [fetchRules]);

    const updateBasePrice = async () => {
        try {
            await api.put(`/turfs/${selectedTurf}/base-price`, { base_price: basePrice });
            toast.success('Base price updated');
        } catch (err: unknown) {
            const error = err as { response?: { data?: { message?: string } } };
            toast.error(error.response?.data?.message || 'Update failed');
        }
    };

    const addRule = async () => {
        try {
            await api.post(`/pricing/rules`, {
                turf_id: selectedTurf,
                multiplier: newRule.multiplier,
                label: newRule.label,
                day_of_week: newRule.day
            });
            toast.success('Pricing rule added');
            fetchRules();
        } catch (err: unknown) {
            const error = err as { response?: { data?: { message?: string } } };
            toast.error(error.response?.data?.message || 'Failed to add rule');
        }
    };

    return (
        <div className="animate-fade-in grid lg:grid-cols-2 gap-8">
            <div className="space-y-6">
                <div className="glass-card p-6">
                    <h3 className="text-sm font-bold text-slate-300 mb-6 flex items-center gap-2"><CurrencyRupeeIcon className="w-4 h-4" /> Base Pricing</h3>
                    <div className="flex gap-4">
                        <div className="flex-1 space-y-1">
                            <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Select Facility</label>
                            <select className="input-field" value={selectedTurf} onChange={e => {
                                setSelectedTurf(e.target.value);
                                setBasePrice(turfs.find(t => t.id.toString() === e.target.value)?.base_price.toString() || '0');
                            }}>
                                {turfs.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                        </div>
                        <div className="w-32 space-y-1">
                            <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Hourly Price</label>
                            <input type="number" className="input-field" value={basePrice} onChange={e => setBasePrice(e.target.value)} />
                        </div>
                    </div>
                    <button onClick={updateBasePrice} className="btn-primary w-full mt-4 justify-center">Save Base Price</button>
                </div>

                <div className="glass-card p-6 border-t-4 border-blue-500">
                    <h3 className="text-sm font-bold text-slate-300 mb-6 flex items-center gap-2"><SparklesIcon className="w-4 h-4" /> Add Smart Pricing Rule</h3>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Type</label><select className="input-field" value={newRule.type} onChange={e => setNewRule({...newRule, type: e.target.value})}><option value="day">Day Specific</option></select></div>
                            <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Value</label><select className="input-field" value={newRule.day} onChange={e => setNewRule({...newRule, day: e.target.value})}>{['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(d => <option key={d}>{d}</option>)}</select></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Multiplier (e.g. 1.5x)</label><input type="number" step="0.1" className="input-field" value={newRule.multiplier} onChange={e => setNewRule({...newRule, multiplier: e.target.value})} /></div>
                            <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Label</label><input className="input-field" value={newRule.label} onChange={e => setNewRule({...newRule, label: e.target.value})} /></div>
                        </div>
                        <button onClick={addRule} className="btn-secondary w-full justify-center">Apply Rule</button>
                    </div>
                </div>
            </div>

            <div className="glass-card p-6">
                <h3 className="text-sm font-bold text-slate-300 mb-6 flex items-center gap-2"><CheckCircleIcon className="w-4 h-4" /> Active Price Adjustments</h3>
                <div className="space-y-4">
                    {rules.length === 0 ? (
                        <div className="text-center py-20 text-slate-500">No custom rules active</div>
                    ) : (
                        rules.map(r => (
                            <div key={r.id} className="p-4 bg-white/5 rounded-2xl border border-white/5 flex justify-between items-center">
                                <div>
                                    <h4 className="text-sm font-bold text-white">{r.label}</h4>
                                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{r.day_of_week || 'Global'}</p>
                                </div>
                                <div className="text-right">
                                    <span className="text-lg font-black text-blue-400">{r.multiplier}x</span>
                                    <p className="text-[10px] text-slate-500 font-bold">Premium</p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
