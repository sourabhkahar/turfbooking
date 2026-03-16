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
    BuildingLibraryIcon,
    DocumentTextIcon,
    DevicePhoneMobileIcon,
    CheckCircleIcon,
    ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

interface BankDetails {
    bank_account_number: string;
    ifsc_code: string;
    pan: string;
    upi_id: string;
}

export default function ProfileForm() {
    const { user, syncUser } = useAuth();
    const [loading, setLoading] = useState(false);
    const [bankLoading, setBankLoading] = useState(false);
    const [name, setName] = useState(user?.name || '');
    const [phone, setPhone] = useState(user?.phone || '');

    const [passwords, setPasswords] = useState({ old: '', new: '', confirm: '' });

    const [bank, setBank] = useState<BankDetails>({
        bank_account_number: '',
        ifsc_code: '',
        pan: '',
        upi_id: ''
    });
    const [bankLoaded, setBankLoaded] = useState(false);

    useEffect(() => {
        if (user) {
            setName(user.name);
            setPhone(user.phone || '');
        }
    }, [user]);

    // Load existing bank details for owners
    useEffect(() => {
        if (user?.role === 'owner' && !bankLoaded) {
            api.get('/payouts/owner/stats').then(({ data }) => {
                if (data.bankInfo) {
                    setBank({
                        bank_account_number: data.bankInfo.bank_account_number || '',
                        ifsc_code: data.bankInfo.ifsc_code || '',
                        pan: data.bankInfo.pan || '',
                        upi_id: data.bankInfo.upi_id || ''
                    });
                }
                setBankLoaded(true);
            }).catch(() => setBankLoaded(true));
        }
    }, [user, bankLoaded]);

    const hasBankDetails = !!(bank.bank_account_number && bank.ifsc_code && bank.pan);

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.patch('/auth/profile', { name, phone });
            await syncUser();
            toast.success('Profile updated successfully');
        } catch (err: unknown) {
            const error = err as { response?: { data?: { message?: string } } };
            toast.error(error.response?.data?.message || 'Update failed');
        } finally {
            setLoading(false);
        }
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (passwords.new !== passwords.confirm) return toast.error('Passwords do not match');
        setLoading(true);
        try {
            await api.patch('/auth/password', { oldPassword: passwords.old, newPassword: passwords.new });
            toast.success('Password updated successfully');
            setPasswords({ old: '', new: '', confirm: '' });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Password change failed';
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateBankDetails = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!bank.bank_account_number) return toast.error('Bank account number is required');
        if (!bank.ifsc_code) return toast.error('IFSC code is required');
        if (!bank.pan) return toast.error('PAN is required');

        const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/i;
        const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i;
        if (!ifscRegex.test(bank.ifsc_code)) return toast.error('Invalid IFSC code (e.g. SBIN0001234)');
        if (!panRegex.test(bank.pan)) return toast.error('Invalid PAN format (e.g. ABCDE1234F)');

        setBankLoading(true);
        try {
            await api.patch('/payouts/owner/bank-details', {
                bank_account_number: bank.bank_account_number,
                ifsc_code: bank.ifsc_code.toUpperCase(),
                pan: bank.pan.toUpperCase(),
                upi_id: bank.upi_id || undefined
            });
            toast.success('Bank details updated successfully');
        } catch (err: unknown) {
            const error = err as { response?: { data?: { message?: string } } };
            toast.error(error.response?.data?.message || 'Failed to update bank details');
        } finally {
            setBankLoading(false);
        }
    };

    if (!user) return null;

    return (
        <div className="space-y-8">
            <div className="grid md:grid-cols-2 gap-8">
                {/* Basic Info */}
                <div className="glass-card p-8 border-t-4 border-blue-600">
                    <div className="flex items-center gap-3 mb-8">
                        <UserIcon className="w-5 h-5 text-blue-500" />
                        <h3 className="text-sm font-black text-white uppercase tracking-widest">Personal Info</h3>
                    </div>
                    <form onSubmit={handleUpdateProfile} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Full Name</label>
                            <div className="relative">
                                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input type="text" value={name} onChange={e => setName(e.target.value)}
                                    className="input-field pl-12" placeholder="John Doe" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Phone</label>
                            <div className="relative">
                                <PhoneIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input type="text" value={phone} onChange={e => setPhone(e.target.value)}
                                    className="input-field pl-12" placeholder="+91 9876543210" />
                            </div>
                        </div>
                        <div className="space-y-2 opacity-60">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Email (Cannot change)</label>
                            <div className="relative">
                                <EnvelopeIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input type="email" value={user.email} disabled className="input-field pl-12 bg-white/5 cursor-not-allowed" />
                            </div>
                        </div>
                        <button type="submit" disabled={loading}
                            className="btn-primary w-full justify-center py-4 font-black uppercase tracking-widest text-xs">
                            {loading ? 'Saving...' : 'Save Changes'}
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
                                <input type="password" value={passwords.old}
                                    onChange={e => setPasswords({ ...passwords, old: e.target.value })}
                                    className="input-field pl-12" placeholder="••••••••" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">New Password</label>
                            <div className="relative">
                                <KeyIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input type="password" value={passwords.new}
                                    onChange={e => setPasswords({ ...passwords, new: e.target.value })}
                                    className="input-field pl-12" placeholder="••••••••" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Confirm New Password</label>
                            <div className="relative">
                                <KeyIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input type="password" value={passwords.confirm}
                                    onChange={e => setPasswords({ ...passwords, confirm: e.target.value })}
                                    className="input-field pl-12" placeholder="••••••••" />
                            </div>
                        </div>
                        <button type="submit" disabled={loading}
                            className="btn-primary w-full justify-center py-4 font-black uppercase tracking-widest text-xs border-emerald-500/20 hover:bg-emerald-600">
                            {loading ? 'Updating...' : 'Update Password'}
                        </button>
                    </form>
                </div>
            </div>

            {/* Bank Details — Owner Only */}
            {user.role === 'owner' && (
                <div className="glass-card p-8 border-t-4 border-amber-500">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                            <BuildingLibraryIcon className="w-5 h-5 text-amber-500" />
                            <div>
                                <h3 className="text-sm font-black text-white uppercase tracking-widest">Banking & Payout Details</h3>
                                <p className="text-[10px] text-slate-500 mt-0.5">Used for direct bank transfers from TurfBook platform</p>
                            </div>
                        </div>
                        {hasBankDetails ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] font-black uppercase tracking-wider">
                                <CheckCircleIcon className="w-3.5 h-3.5" /> Verified
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 text-amber-400 text-[10px] font-black uppercase tracking-wider">
                                <ExclamationTriangleIcon className="w-3.5 h-3.5" /> Incomplete
                            </span>
                        )}
                    </div>

                    {!hasBankDetails && (
                        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-6">
                            <p className="text-xs text-amber-400 font-semibold leading-relaxed">
                                ⚠️ Your bank details are incomplete. Admin cannot transfer your earnings until you fill in your bank account details, IFSC code, and PAN.
                            </p>
                        </div>
                    )}

                    <form onSubmit={handleUpdateBankDetails} className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                                Bank Account Number <span className="text-red-400">*</span>
                            </label>
                            <div className="relative">
                                <BuildingLibraryIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input type="text" value={bank.bank_account_number}
                                    onChange={e => setBank({ ...bank, bank_account_number: e.target.value })}
                                    className="input-field pl-12 font-mono" placeholder="e.g. 1234567890123" />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                                IFSC Code <span className="text-red-400">*</span>
                            </label>
                            <div className="relative">
                                <DocumentTextIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input type="text" value={bank.ifsc_code} maxLength={11}
                                    onChange={e => setBank({ ...bank, ifsc_code: e.target.value.toUpperCase() })}
                                    className="input-field pl-12 uppercase font-mono" placeholder="e.g. SBIN0001234" />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                                PAN Number <span className="text-red-400">*</span>
                            </label>
                            <div className="relative">
                                <DocumentTextIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input type="text" value={bank.pan} maxLength={10}
                                    onChange={e => setBank({ ...bank, pan: e.target.value.toUpperCase() })}
                                    className="input-field pl-12 uppercase font-mono" placeholder="e.g. ABCDE1234F" />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                                UPI ID <span className="text-slate-600 text-[9px] normal-case">(optional)</span>
                            </label>
                            <div className="relative">
                                <DevicePhoneMobileIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input type="text" value={bank.upi_id}
                                    onChange={e => setBank({ ...bank, upi_id: e.target.value })}
                                    className="input-field pl-12" placeholder="e.g. name@upi" />
                            </div>
                        </div>

                        <div className="md:col-span-2">
                            <button type="submit" disabled={bankLoading}
                                className="flex items-center gap-2 px-8 py-4 bg-amber-500/20 border border-amber-500/40 text-amber-400 font-black text-xs uppercase tracking-widest rounded-xl hover:bg-amber-500/30 transition-all disabled:opacity-50">
                                <BuildingLibraryIcon className="w-4 h-4" />
                                {bankLoading ? 'Saving bank details...' : 'Save Banking Details'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
