'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Suspense } from 'react';

function LoginForm() {
    const { login, user } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [form, setForm] = useState({ email: '', password: '' });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (user) {
            const redirect = searchParams?.get('redirect');
            if (redirect) router.push(redirect);
            else if (user.role === 'super_admin') router.push('/admin');
            else if (user.role === 'owner') router.push('/owner');
            else router.push('/customer');
        }
    }, [user, router, searchParams]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await login(form.email, form.password);
            toast.success('Welcome back!');
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center px-4 py-16">
            <div className="glass-card p-8 w-full max-w-md animate-fade-in">
                <div className="text-center mb-8">
                    <span className="text-4xl">⚽</span>
                    <h1 className="text-2xl font-bold text-white mt-3">Welcome Back</h1>
                    <p className="text-slate-400 mt-1">Sign in to your TurfBook account</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
                        <input type="email" className="input-field" placeholder="you@example.com"
                            value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
                        <input type="password" className="input-field" placeholder="••••••••"
                            value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required />
                    </div>

                    <button type="submit" className="btn-primary w-full justify-center py-3 mt-2" disabled={loading}>
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>

                <p className="text-center text-slate-400 text-sm mt-6">
                    Don't have an account?{' '}
                    <Link href="/register" className="text-green-400 hover:underline font-medium">Create one →</Link>
                </p>

                <div className="mt-6 p-3 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-400">
                    <strong className="text-slate-300">Super Admin:</strong> admin@turf.com / Admin@123
                </div>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return <Suspense><LoginForm /></Suspense>;
}
