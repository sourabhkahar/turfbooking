'use client';
import { useEffect, useState, use } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { PencilSquareIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import MediaUpload from '@/components/MediaUpload';
import Link from 'next/link';

const SPORTS = ['Football', 'Cricket', 'Basketball', 'Tennis', 'Badminton', 'Hockey', 'Volleyball'];

export default function EditTurf({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const { id: turfId } = use(params);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState({ 
        name: '', 
        description: '', 
        location: '', 
        city: '', 
        sport_type: 'Football', 
        facilities: '', 
        part_payment_percentage: '0' 
    });
    const [media, setMedia] = useState<{ url: string; type: 'image' | 'video' }[]>([]);

    useEffect(() => {
        const fetchTurf = async () => {
            try {
                const { data } = await api.get(`/turfs/${turfId}`);
                setForm({
                    name: data.name,
                    description: data.description || '',
                    location: data.location,
                    city: data.city,
                    sport_type: data.sport_type,
                    facilities: Array.isArray(data.facilities) ? data.facilities.join(', ') : '',
                    part_payment_percentage: data.part_payment_percentage?.toString() || '0'
                });
                setMedia(data.images || []);
            } catch {
                toast.error('Failed to load turf details');
                router.push('/owner/turfs');
            } finally {
                setLoading(false);
            }
        };
        fetchTurf();
    }, [turfId, router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.put(`/turfs/${turfId}`, {
                ...form,
                facilities: form.facilities.split(',').map(f => f.trim()).filter(f => f),
                part_payment_percentage: parseInt(form.part_payment_percentage) || 0,
                images: media
            });
            toast.success('Turf updated successfully!');
            router.push('/owner/turfs');
        } catch (err: unknown) {
            const error = err as { response?: { data?: { message?: string } } };
            toast.error(error.response?.data?.message || 'Error updating turf');
        }
    };

    if (loading) return (
        <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-green-400" />
        </div>
    );

    return (
        <div className="animate-fade-in max-w-3xl">
            <div className="mb-6">
                <Link href="/owner/turfs" className="text-slate-500 hover:text-white flex items-center gap-2 text-xs font-bold uppercase tracking-widest transition-colors">
                    <ArrowLeftIcon className="w-4 h-4" /> Back to My Turfs
                </Link>
            </div>

            <div className="glass-card p-8 border-l-4 border-blue-500">
                <h2 className="text-xl font-black text-white mb-8 flex items-center gap-3"><PencilSquareIcon className="w-6 h-6" /> Edit Facility Details</h2>
                <form onSubmit={handleSubmit} className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Turf Name</label><input className="input-field" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required /></div>
                    <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Primary Sport</label><select className="input-field" value={form.sport_type} onChange={e => setForm({...form, sport_type: e.target.value})}>{SPORTS.map(s => <option key={s}>{s}</option>)}</select></div>
                    <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">City</label><input className="input-field" value={form.city} onChange={e => setForm({...form, city: e.target.value})} required /></div>
                    <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Detailed Address</label><input className="input-field" value={form.location} onChange={e => setForm({...form, location: e.target.value})} required /></div>
                    <div className="space-y-1 md:col-span-2"><label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Facilities (comma separated)</label><input className="input-field" value={form.facilities} onChange={e => setForm({...form, facilities: e.target.value})} /></div>
                    <div className="space-y-1 md:col-span-2"><label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Online Advance (%)</label><input type="number" min="0" max="100" className="input-field" value={form.part_payment_percentage} onChange={e => setForm({...form, part_payment_percentage: e.target.value})} /></div>
                    
                    <div className="md:col-span-2 mt-4">
                        <MediaUpload value={media} onChange={setMedia} />
                    </div>

                    <div className="md:col-span-2 mt-4 flex gap-4">
                        <button type="submit" className="btn-primary flex-1 justify-center py-4 text-sm font-bold">Save Changes</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
