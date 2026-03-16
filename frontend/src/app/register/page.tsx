'use client';
import { useState, useEffect, Suspense } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { BuildingLibraryIcon, UserCircleIcon } from '@heroicons/react/24/outline';

function RegisterForm() {
    const { register, user } = useAuth();
    const router = useRouter();
    const params = useSearchParams();
    const [form, setForm] = useState({
        name: '', email: '', password: '', phone: '',
        role: params.get('role') || 'user',
        // Banking fields (owner only)
        bank_account_number: '', ifsc_code: '', pan: '', upi_id: ''
    });
    const [step, setStep] = useState(1); // 1 = basic info, 2 = banking info (owners only)
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (user) {
            if (user.role === 'super_admin') router.push('/admin');
            else if (user.role === 'owner') router.push('/owner');
            else router.push('/customer');
        }
    }, [user, router]);

    const goToStep2 = (e: React.FormEvent) => {
        e.preventDefault();
        if (form.password.length < 6) return toast.error('Password must be at least 6 characters');
        if (form.role === 'owner') {
            setStep(2);
        } else {
            handleFinalSubmit();
        }
    };

    const handleFinalSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        // Validate banking if owner
        if (form.role === 'owner') {
            if (!form.bank_account_number) return toast.error('Bank account number is required');
            if (!form.ifsc_code) return toast.error('IFSC code is required');
            if (!form.pan) return toast.error('PAN is required');
            const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/i;
            const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i;
            if (!ifscRegex.test(form.ifsc_code)) return toast.error('Invalid IFSC code (e.g. SBIN0001234)');
            if (!panRegex.test(form.pan)) return toast.error('Invalid PAN format (e.g. ABCDE1234F)');
        }

        setLoading(true);
        try {
            await register({
                name: form.name, email: form.email,
                password: form.password, role: form.role as 'owner' | 'user',
                phone: form.phone,
                ...(form.role === 'owner' ? {
                    bank_account_number: form.bank_account_number,
                    ifsc_code: form.ifsc_code.toUpperCase(),
                    pan: form.pan.toUpperCase(),
                    upi_id: form.upi_id || undefined
                } : {})
            });
            toast.success('Account created! Welcome!');
        } catch (err: unknown) {
            const error = err as { response?: { data?: { message?: string; errors?: { msg: string }[] } } };
            toast.error(error.response?.data?.message || error.response?.data?.errors?.[0]?.msg || 'Registration failed');
        } finally {
            setLoading(false);
        }
    };

    const isOwner = form.role === 'owner';

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
                        <button key={r.value} type="button"
                            onClick={() => { setForm({ ...form, role: r.value }); setStep(1); }}
                            className={`flex-1 py-3 text-sm font-semibold transition-all ${form.role === r.value ? 'bg-green-500 text-white' : 'text-slate-400 hover:text-white'}`}>
                            {r.label}
                        </button>
                    ))}
                </div>

                {/* Step Indicator (owner only) */}
                {isOwner && (
                    <div className="flex items-center gap-2 mb-6">
                        <div className={`flex items-center gap-2 flex-1 ${step === 1 ? 'opacity-100' : 'opacity-50'}`}>
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black ${step >= 1 ? 'bg-green-500 text-white' : 'bg-white/10 text-slate-400'}`}>
                                <UserCircleIcon className="w-4 h-4" />
                            </div>
                            <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Profile</span>
                        </div>
                        <div className="h-px flex-1 bg-white/10" />
                        <div className={`flex items-center gap-2 flex-1 ${step === 2 ? 'opacity-100' : 'opacity-50'}`}>
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black ${step >= 2 ? 'bg-green-500 text-white' : 'bg-white/10 text-slate-400'}`}>
                                <BuildingLibraryIcon className="w-4 h-4" />
                            </div>
                            <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Banking</span>
                        </div>
                    </div>
                )}

                {/* STEP 1: Basic Info */}
                {step === 1 && (
                    <form onSubmit={isOwner ? goToStep2 : handleFinalSubmit} className="space-y-4">
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
                            {isOwner ? 'Next: Banking Details →' : (loading ? 'Creating account...' : 'Create Player Account')}
                        </button>
                    </form>
                )}

                {/* STEP 2: Banking Info (Owner only) */}
                {step === 2 && isOwner && (
                    <form onSubmit={handleFinalSubmit} className="space-y-4">
                        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 mb-2">
                            <p className="text-[11px] text-amber-400 font-semibold leading-relaxed">
                                💳 These details are used to transfer your earnings directly to your bank account. They are encrypted and secure.
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Bank Account Number <span className="text-red-400">*</span>
                            </label>
                            <input type="text" className="input-field" placeholder="e.g. 1234567890123"
                                value={form.bank_account_number}
                                onChange={e => setForm({ ...form, bank_account_number: e.target.value })} required />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                IFSC Code <span className="text-red-400">*</span>
                            </label>
                            <input type="text" className="input-field uppercase" placeholder="e.g. SBIN0001234"
                                value={form.ifsc_code} maxLength={11}
                                onChange={e => setForm({ ...form, ifsc_code: e.target.value.toUpperCase() })} required />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                PAN Number <span className="text-red-400">*</span>
                            </label>
                            <input type="text" className="input-field uppercase" placeholder="e.g. ABCDE1234F"
                                value={form.pan} maxLength={10}
                                onChange={e => setForm({ ...form, pan: e.target.value.toUpperCase() })} required />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                UPI ID <span className="text-slate-500 text-xs">(optional)</span>
                            </label>
                            <input type="text" className="input-field" placeholder="e.g. name@upi"
                                value={form.upi_id}
                                onChange={e => setForm({ ...form, upi_id: e.target.value })} />
                        </div>

                        <div className="flex gap-3 pt-1">
                            <button type="button" onClick={() => setStep(1)}
                                className="flex-1 py-3 rounded-xl border border-white/10 text-slate-300 font-semibold hover:bg-white/5 transition-all">
                                ← Back
                            </button>
                            <button type="submit" className="btn-primary flex-1 justify-center py-3" disabled={loading}>
                                {loading ? 'Creating account...' : 'Create Owner Account'}
                            </button>
                        </div>
                    </form>
                )}

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
