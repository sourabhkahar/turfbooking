'use client';
import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { ClockIcon, LockClosedIcon, LockOpenIcon } from '@heroicons/react/24/outline';

interface Turf { id: number; name: string; }
interface Slot { slot_id: number; is_blocked: number; start_time: string; end_time: string; status: string; }

export default function SlotManager() {
    const [turfs, setTurfs] = useState<Turf[]>([]);
    const [selectedTurf, setSelectedTurf] = useState('');
    const [slots, setSlots] = useState<Slot[]>([]);
    const [loading, setLoading] = useState(false);

    const getTodayDateString = () => {
        const today = new Date();
        // Adjust for timezone offset to ensure correct date regardless of local time
        today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
        return today.toISOString().split("T")[0]; // Returns date in "YYYY-MM-DD" format
    };
    const todayString = getTodayDateString();

    const [selectedDate, setSelectedDate] = useState(todayString);
    const [generateStart, setGenerateStart] = useState(todayString);
    const [generateEnd, setGenerateEnd] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() + 6);
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        return d.toISOString().split("T")[0];
    });

    useEffect(() => {
        const fetchTurfs = async () => { // Async wrapper for fetch call
            try {
                const res = await api.get('/turfs/owner/my');
                const turfsData = res.data.data || res.data;
                const dataArray = Array.isArray(turfsData) ? turfsData : [];
                setTurfs(dataArray);
                if (dataArray.length > 0) {
                    setSelectedTurf(dataArray[0].id.toString());
                }
            } catch (err) {
                console.error("Failed to fetch turfs:", err);
                toast.error("Could not load your facilities");
            }
        };
        fetchTurfs();
    }, []);

    const fetchSlots = useCallback(async () => {
        if (!selectedTurf) return;
        setLoading(true);
        try {
            const { data } = await api.get(`/slots/${selectedTurf}?date=${selectedDate}`);
            setSlots(data);
        } catch (err: unknown) {
            console.error(err);
        }
        setLoading(false);
    }, [selectedTurf, selectedDate]);

    useEffect(() => {
        const load = async () => {
            await fetchSlots();
        };
        load();
    }, [fetchSlots]);

    const toggleSlot = async (slotId: number, currentStatus: number, status: string) => {
        if (status === 'booked') {
            toast.error('Cannot modify a booked slot');
            return;
        }
        try {
            if (currentStatus === 1) await api.post(`/slots/unblock/${slotId}`);
            else await api.post(`/slots/block`, { slot_id: slotId });
            toast.success(currentStatus === 1 ? 'Slot opened' : 'Slot blocked');
            fetchSlots();
        } catch (err: unknown) {
            const error = err as { response?: { data?: { message?: string } } };
            toast.error(error.response?.data?.message || 'Action failed');
        }
    };

    const generateSlots = async () => {
        if (!selectedTurf) return;
        
        if (new Date(generateStart) > new Date(generateEnd)) {
            toast.error('Start date cannot be after end date');
            return;
        }

        try {
            await api.post(`/slots/generate/${selectedTurf}`, {
                start_date: generateStart,
                end_date: generateEnd
            });
            toast.success(`Slots generated from ${generateStart} to ${generateEnd}`);
            fetchSlots();
        } catch (err: unknown) {
            const error = err as { response?: { data?: { message?: string } } };
            toast.error(error.response?.data?.message || 'Generation failed');
        }
    };



    return (
        <div className="animate-fade-in grid lg:grid-cols-4 gap-6">
            <div className="lg:col-span-1 space-y-4">
                <div className="glass-card p-4 space-y-4">
                    <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Select Facility</label><select className="input-field" value={selectedTurf} onChange={e => setSelectedTurf(e.target.value)}>{turfs.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
                    <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">View Slots For Date</label><input type="date" className="input-field" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} min={todayString} /></div>
                    
                    <div className="pt-4 border-t border-slate-700/50 space-y-4">
                        <h4 className="text-xs font-bold text-slate-300">Generate Slots</h4>
                        <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Start Date</label><input type="date" className="input-field" value={generateStart} onChange={e => setGenerateStart(e.target.value)} min={todayString} /></div>
                        <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">End Date</label><input type="date" className="input-field" value={generateEnd} onChange={e => setGenerateEnd(e.target.value)} min={generateStart} /></div>
                        <button onClick={generateSlots} className="btn-primary w-full justify-center mt-2">Generate Custom Slots</button>
                    </div>
                </div>
            </div>

            <div className="lg:col-span-3">
                <div className="glass-card p-6 min-h-[400px]">
                    <h3 className="text-sm font-bold text-slate-300 mb-6 flex items-center gap-2"><ClockIcon className="w-4 h-4" /> Available Slots for {selectedDate}</h3>
                    {loading ? (
                        <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-green-400" /></div>
                    ) : slots.length === 0 ? (
                        <div className="text-center py-20 text-slate-500 font-medium">No slots found. Use Generate Weekly Slots to create them.</div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
                            {slots.map(s => {
                                const slotDateTime = new Date(`${selectedDate}T${s.start_time}`);
                                const isPast = slotDateTime < new Date();
                                const isRed = s.status === 'blocked' || s.status === 'booked' || isPast;
                                return (
                                    <button
                                        key={s.slot_id}
                                        onClick={() => toggleSlot(s.slot_id, s.is_blocked, s.status)}
                                        className={`p-3 rounded-xl border text-left transition-all group ${isRed ? 'bg-red-500/10 border-red-500/20 opacity-60 cursor-not-allowed' : 'bg-green-500/5 border-green-500/10 hover:border-green-500/40'}`}
                                        disabled={s.status === 'booked' || isPast}
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <span className={`text-[10px] font-bold ${isRed ? 'text-red-400' : 'text-green-400'}`}>
                                                {isPast ? 'PASSED' : s.status.toUpperCase()}
                                            </span>
                                            {isRed ? <LockClosedIcon className="w-3 h-3 text-red-400" /> : <LockOpenIcon className="w-3 h-3 text-green-400" />}
                                        </div>
                                        <p className="text-xs font-black text-white">{s.start_time.slice(0, 5)} - {s.end_time.slice(0, 5)}</p>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
