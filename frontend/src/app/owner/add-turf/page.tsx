'use client';
import { useState } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { PlusCircleIcon } from '@heroicons/react/24/outline';
import MediaUpload from '@/components/MediaUpload';

const SPORTS = ['Football', 'Cricket', 'Basketball', 'Tennis', 'Badminton', 'Hockey', 'Volleyball'];

export default function AddTurf() {
    const router = useRouter();
    const [form, setForm] = useState({ name: '', description: '', location: '', city: '', sport_type: 'Football', facilities: '', part_payment_percentage: '0' });
    const [media, setMedia] = useState<{ url: string; type: 'image' | 'video' }[]>([]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.post('/turfs', {
                ...form,
                facilities: form.facilities.split(',').map(f => f.trim()),
                part_payment_percentage: parseInt(form.part_payment_percentage) || 0,
                images: media // We store both images and videos in this JSON field
            });
            toast.success('Turf submitted for admin approval!');
            router.push('/owner/turfs');
        } catch (err: unknown) { 
            const error = err as { response?: { data?: { message?: string } } };
            toast.error(error.response?.data?.message || 'Error creating turf'); 
        }
    };

    return (
        <div className="animate-fade-in max-w-3xl">
            <div className="glass-card p-8 border-l-4 border-green-500">
                <h2 className="text-xl font-black text-white mb-8 flex items-center gap-3"><PlusCircleIcon className="w-6 h-6" /> Register New Facility</h2>
                <form onSubmit={handleSubmit} className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Turf Name</label><input className="input-field" placeholder="Pro Arena One" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required /></div>
                    <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Primary Sport</label><select className="input-field" value={form.sport_type} onChange={e => setForm({...form, sport_type: e.target.value})}>{SPORTS.map(s => <option key={s}>{s}</option>)}</select></div>
                    <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">City</label><input className="input-field" placeholder="Mumbai" value={form.city} onChange={e => setForm({...form, city: e.target.value})} required /></div>
                    <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Detailed Address</label><input className="input-field" placeholder="Near SV Road" value={form.location} onChange={e => setForm({...form, location: e.target.value})} required /></div>
                    <div className="space-y-1 md:col-span-2"><label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Facilities (comma separated)</label><input className="input-field" placeholder="Parking, Lighting" value={form.facilities} onChange={e => setForm({...form, facilities: e.target.value})} /></div>
                    <div className="space-y-1 md:col-span-2"><label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Online Advance (%)</label><input type="number" min="0" max="100" className="input-field" value={form.part_payment_percentage} onChange={e => setForm({...form, part_payment_percentage: e.target.value})} /></div>
                    <div className="md:col-span-2 mt-4">
                        <MediaUpload value={media} onChange={setMedia} />
                    </div>
                    <button type="submit" className="btn-primary md:col-span-2 justify-center py-4 text-sm font-bold mt-4">Submit Application →</button>
                </form>
            </div>
        </div>
    );
}
