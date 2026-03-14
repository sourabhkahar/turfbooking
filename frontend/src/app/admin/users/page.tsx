'use client';
import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { ShieldCheckIcon, ShieldExclamationIcon, AtSymbolIcon } from '@heroicons/react/24/outline';

import Pagination from '@/components/Pagination';

interface User { id: number; name: string; email: string; role: string; status: string; }

export default function AdminUsers() {
    const [users, setUsers] = useState<User[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const itemsPerPage = 10;

    const fetchUsers = useCallback(async () => {
        try {
            const { data: response } = await api.get(`/admin/users?page=${currentPage}&limit=${itemsPerPage}`);
            if (response.data) {
                setUsers(response.data);
                setTotalPages(response.totalPages);
            } else {
                setUsers(response); 
            }
        } catch { }
    }, [currentPage, itemsPerPage]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    const currentData = users; 

    const toggleStatus = async (id: number, currentStatus: string) => {
        try {
            const nextStatus = currentStatus === 'active' ? 'disabled' : 'active';
            await api.patch(`/admin/users/${id}/status`, { status: nextStatus });
            toast.success(`User access ${nextStatus === 'disabled' ? 'revoked' : 'restored'}`);
            fetchUsers();
        } catch { }
    };

    return (
        <div className="animate-fade-in space-y-8">
            <div className="glass-card overflow-hidden">
                <div className="p-8 border-b border-white/5 bg-white/5 flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-black text-white uppercase tracking-widest">Network Directory</h3>
                        <p className="text-[10px] text-slate-500 font-bold mt-1">Global user and operator database</p>
                    </div>
                </div>
                <div className="table-responsive">
                    <table className="modern-table">
                        <thead>
                            <tr>
                                <th>IDENTITY</th>
                                <th>ACCESS POINT</th>
                                <th>LEVEL</th>
                                <th>AUTHORIZATION</th>
                                <th>PROTOCOLS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {currentData.map(u => (
                                <tr key={u.id} className="hover:bg-white/5 group">
                                    <td>
                                        <div className="font-black text-white">{u.name}</div>
                                        <div className="text-[10px] text-slate-500 font-bold">UID-{u.id.toString().padStart(6, '0')}</div>
                                    </td>
                                    <td>
                                        <div className="flex items-center gap-2 text-slate-400 font-medium">
                                            <AtSymbolIcon className="w-3 h-3 text-blue-500" /> {u.email}
                                        </div>
                                    </td>
                                    <td>
                                        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md ${u.role === 'super_admin' ? 'bg-red-500/10 text-red-400' : u.role === 'owner' ? 'bg-purple-500/10 text-purple-400' : 'bg-blue-500/10 text-blue-400'}`}>
                                            {u.role}
                                        </span>
                                    </td>
                                    <td>
                                        <span className={`badge ${u.status === 'active' ? 'badge-green' : 'badge-red'}`}>{u.status === 'active' ? 'authorized' : 'restricted'}</span>
                                    </td>
                                    <td>
                                        <button 
                                            onClick={() => toggleStatus(u.id, u.status)}
                                            className={`p-3 rounded-xl transition-all border border-white/5 ${u.status === 'active' ? 'hover:bg-red-500/10 text-slate-500 hover:text-red-400' : 'bg-green-500/10 text-green-400 hover:bg-green-500 hover:text-white'}`}
                                        >
                                            {u.status === 'active' ? <ShieldExclamationIcon className="w-4 h-4" /> : <ShieldCheckIcon className="w-4 h-4" />}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <Pagination 
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                />
            </div>
        </div>
    );
}
