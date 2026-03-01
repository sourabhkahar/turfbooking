'use client';
import { useState, useEffect, Suspense } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';

function RegisterForm() {
    const { register, user } = useAuth();
    const router = useRouter();
    const params = useSearchParams();
    const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', role: params.get('role') || 'user' });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (user) {
            if (user.role === 'super_admin') router.push('/admin');
            else if (user.role === 'owner') router.push('/owner');
            else router.push('/customer');
        }
    }, [user, router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (form.password.length < 6) return toast.error('Password must be at least 6 characters');
        setLoading(true);
        try {
            await register({ name: form.name, email: form.email, password: form.password, role: form.role as 'owner' | 'user', phone: form.phone });
            toast.success('Account created! Welcome!');
        } catch (err: any) {
            toast.error(err.response?.data?.message || err.response?.data?.errors?.[0]?.msg || 'Registration failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center px-4 py-16">
            <div className="glass-card p-8 w-full max-w-md animate-fade-in">
                <div className="text-center mb-8">
                    <span className="text-4xl">⚽</span>
                    <h1 className="text-2xl font-bold text-white mt-3">Create Account</h1>
                    <p className="text-slate-400 mt-1">Join TurfBook today</p>
                </div>

                {/* Role Toggle */}
                <div className="flex rounded-xl overflow-hidden border border-white/10 mb-6">
                    {[{ label: '🎮 Player', value: 'user' }, { label: '🏟️ Turf Owner', value: 'owner' }].map(r => (
                        <button key={r.value} type="button" onClick={() => setForm({ ...form, role: r.value })}
                            className={`flex-1 py-3 text-sm font-semibold transition-all ${form.role === r.value ? 'bg-green-500 text-white' : 'text-slate-400 hover:text-white'}`}>
                            {r.label}
                        </button>
                    ))}
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Full Name</label>
                        <input type="text" className="input-field" placeholder="John Doe"
                            value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
                        <input type="email" className="input-field" placeholder="you@example.com"
                            value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Phone</label>
                        <input type="tel" className="input-field" placeholder="+91 9876543210"
                            value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
                        <input type="password" className="input-field" placeholder="Min 6 characters"
                            value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required />
                    </div>

                    <button type="submit" className="btn-primary w-full justify-center py-3 mt-2" disabled={loading}>
                        {loading ? 'Creating account...' : `Create ${form.role === 'owner' ? 'Owner' : 'Player'} Account`}
                    </button>
                </form>

                <p className="text-center text-slate-400 text-sm mt-6">
                    Already have an account?{' '}
                    <Link href="/login" className="text-green-400 hover:underline font-medium">Sign in →</Link>
                </p>
            </div>
        </div>
    );
}

export default function RegisterPage() {
    return <Suspense><RegisterForm /></Suspense>;
}
