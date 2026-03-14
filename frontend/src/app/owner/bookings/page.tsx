'use client';
import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { ClipboardDocumentListIcon, XCircleIcon, CurrencyRupeeIcon } from '@heroicons/react/24/outline';

import Pagination from '@/components/Pagination';

interface Booking { id: number; turf_name: string; booking_date: string; start_time: string; end_time: string; total_price: number; paid_amount: number; status: string; user_name: string; payment_status: string; settlement_status: string; }

export default function OwnerBookings() {
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const itemsPerPage = 10;

    const fetchBookings = useCallback(async () => {
        try {
            const { data: response } = await api.get(`/owner/bookings?page=${currentPage}&limit=${itemsPerPage}`);
            if (response.data) {
                setBookings(response.data);
                setTotalPages(response.totalPages);
            } else {
                setBookings(response);
            }
        } catch { }
    }, [currentPage, itemsPerPage]);

    useEffect(() => {
        const load = async () => {
            await fetchBookings();
        };
        load();
    }, [fetchBookings]);

    const currentData = bookings;

    const handleSettle = async (id: number) => {
        try {
            await api.post(`/owner/bookings/${id}/settle`);
            toast.success('Payment settled at venue');
            fetchBookings();
        } catch { }
    };

    const handleCancel = async (id: number) => {
        if (!confirm('Are you sure you want to cancel this booking?')) return;
        try {
            await api.post(`/owner/bookings/${id}/cancel`);
            toast.success('Booking cancelled');
            fetchBookings();
        } catch { }
    };

    return (
        <div className="animate-fade-in space-y-4">
            <div className="glass-card overflow-hidden">
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2"><ClipboardDocumentListIcon className="w-4 h-4 text-blue-400" /> Recent Activity</h3>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{bookings.length} Total Bookings</p>
                </div>
                <div className="table-responsive">
                    <table className="modern-table">
                        <thead>
                            <tr>
                                <th>CLIENT</th>
                                <th>VENUE / TIME</th>
                                <th>FINANCIALS</th>
                                <th>STATUS</th>
                                <th>ACTIONS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {currentData.map(b => (
                                <tr key={b.id} className="hover:bg-white/5 transition-colors">
                                    <td>
                                        <div className="font-bold text-white">{b.user_name}</div>
                                        <div className="text-[10px] text-slate-500 font-bold uppercase">ID: #{b.id}</div>
                                    </td>
                                    <td>
                                        <div className="font-bold text-slate-300">{b.turf_name}</div>
                                        <div className="text-[10px] text-blue-400 font-bold uppercase">{b.booking_date} | {b.start_time.slice(0, 5)}-{b.end_time.slice(0, 5)}</div>
                                    </td>
                                    <td>
                                        <div className="font-bold text-white">₹{b.total_price}</div>
                                        <div className="text-[10px] text-green-500 font-bold uppercase">PAID: ₹{b.paid_amount}</div>
                                    </td>
                                    <td>
                                        <div className={`badge ${b.status === 'confirmed' ? 'badge-green' : b.status === 'cancelled' ? 'badge-red' : 'badge-yellow'}`}>{b.status}</div>
                                        <div className="text-[10px] text-slate-500 font-bold uppercase mt-1">{b.settlement_status}</div>
                                    </td>
                                    <td>
                                        <div className="flex gap-2">
                                            {b.settlement_status === 'pending' && b.status === 'confirmed' && (
                                                <button onClick={() => handleSettle(b.id)} className="p-2 hover:bg-green-500/10 text-green-400 rounded-lg" title="Settle Hub Payment"><CurrencyRupeeIcon className="w-4 h-4" /></button>
                                            )}
                                            {b.status === 'confirmed' && (
                                                <button onClick={() => handleCancel(b.id)} className="p-2 hover:bg-red-500/10 text-red-400 rounded-lg" title="Cancel Booking"><XCircleIcon className="w-4 h-4" /></button>
                                            )}
                                        </div>
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
