'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { 
    UserIcon, 
    PhoneIcon, 
    EnvelopeIcon, 
    KeyIcon,
    ShieldCheckIcon,
} from '@heroicons/react/24/outline';

export default function ProfileForm() {
    const { user, syncUser } = useAuth();
    const [loading, setLoading] = useState(false);
    const [name, setName] = useState(user?.name || '');
    const [phone, setPhone] = useState(user?.phone || '');
    
    const [passwords, setPasswords] = useState({
        old: '',
        new: '',
        confirm: ''
    });

    useEffect(() => {
        if (user) {
            setName(user.name);
            setPhone(user.phone || '');
        }
    }, [user]);

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.patch('/auth/profile', { name, phone });
            await syncUser();
            toast.success('Identity protocols updated');
        } catch (err: unknown) {
            const error = err as { response?: { data?: { message?: string } } };
            toast.error(error.response?.data?.message || 'Update failed');
        } finally {
            setLoading(false);
        }
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (passwords.new !== passwords.confirm) {
            return toast.error('Passwords do not match');
        }
        setLoading(true);
        try {
            await api.patch('/auth/password', { 
                oldPassword: passwords.old, 
                newPassword: passwords.new 
            });
            toast.success('Security clearance updated');
            setPasswords({ old: '', new: '', confirm: '' });
        } catch (err: unknown) {
             const message = err instanceof Error ? err.message : 'Password change failed';
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    if (!user) return null;

    return (
        <div className="grid md:grid-cols-2 gap-8">
            {/* Basic Info */}
            <div className="glass-card p-8 border-t-4 border-blue-600">
                <div className="flex items-center gap-3 mb-8">
                    <UserIcon className="w-5 h-5 text-blue-500" />
                    <h3 className="text-sm font-black text-white uppercase tracking-widest">Personal Matrix</h3>
                </div>
                <form onSubmit={handleUpdateProfile} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Full Name</label>
                        <div className="relative">
                            <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <input 
                                type="text" 
                                value={name}
                                onChange={e => setName(e.target.value)}
                                className="input-field pl-12" 
                                placeholder="Identification Name"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Communication Line</label>
                        <div className="relative">
                            <PhoneIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <input 
                                type="text" 
                                value={phone}
                                onChange={e => setPhone(e.target.value)}
                                className="input-field pl-12" 
                                placeholder="+91 XXXXX XXXXX"
                            />
                        </div>
                    </div>
                    <div className="space-y-2 opacity-60">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Email Registry (Immutable)</label>
                        <div className="relative">
                            <EnvelopeIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <input type="email" value={user.email} disabled className="input-field pl-12 bg-white/5 cursor-not-allowed" />
                        </div>
                    </div>
                    <button 
                        type="submit" 
                        disabled={loading}
                        className="btn-primary w-full justify-center py-4 font-black uppercase tracking-widest text-xs"
                    >
                        {loading ? 'Syncing...' : 'Update Records'}
                    </button>
                </form>
            </div>

            {/* Security */}
            <div className="glass-card p-8 border-t-4 border-emerald-600">
                <div className="flex items-center gap-3 mb-8">
                    <ShieldCheckIcon className="w-5 h-5 text-emerald-500" />
                    <h3 className="text-sm font-black text-white uppercase tracking-widest">Security Settings</h3>
                </div>
                <form onSubmit={handleChangePassword} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Current Password</label>
                        <div className="relative">
                            <KeyIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <input 
                                type="password" 
                                value={passwords.old}
                                onChange={e => setPasswords({...passwords, old: e.target.value})}
                                className="input-field pl-12" 
                                placeholder="••••••••"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">New Password</label>
                        <div className="relative">
                            <KeyIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <input 
                                type="password" 
                                value={passwords.new}
                                onChange={e => setPasswords({...passwords, new: e.target.value})}
                                className="input-field pl-12" 
                                placeholder="••••••••"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Confirm New Password</label>
                        <div className="relative">
                            <KeyIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <input 
                                type="password" 
                                value={passwords.confirm}
                                onChange={e => setPasswords({...passwords, confirm: e.target.value})}
                                className="input-field pl-12" 
                                placeholder="••••••••"
                            />
                        </div>
                    </div>
                    <button 
                        type="submit" 
                        disabled={loading}
                        className="btn-primary w-full justify-center py-4 font-black uppercase tracking-widest text-xs border-emerald-500/20 hover:bg-emerald-600"
                    >
                        {loading ? 'Encrypting...' : 'Update Password'}
                    </button>
                </form>
            </div>
        </div>
    );
}
