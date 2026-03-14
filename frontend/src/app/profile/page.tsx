'use client';
import { useAuth } from '@/context/AuthContext';
import ProfileForm from '@/components/ProfileForm';

export default function ProfilePage() {
    const { user } = useAuth();

    if (!user) return null;

    return (
        <div className="min-h-screen bg-[#050510] pt-24 pb-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-6">
                        <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white text-4xl font-black shadow-2xl shadow-blue-500/20">
                            {user.name[0].toUpperCase()}
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-white tracking-tighter uppercase">{user.name}</h1>
                            <p className="text-slate-500 font-bold text-xs tracking-widest uppercase mt-1">
                                {user.role.replace('_', ' ')} • ID-{user.id.toString().padStart(6, '0')}
                            </p>
                        </div>
                    </div>
                </div>

                <ProfileForm />
            </div>
        </div>
    );
}
