'use client';

import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
}

export default function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
    if (totalPages <= 1) return null;

    const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
    
    // Logic for visible page numbers (e.g., [1, 2, 3, ..., 10]) could be added later if needed
    // For now, let's keep it simple

    return (
        <div className="flex items-center justify-between px-6 py-4 bg-white/5 border-t border-white/5">
            <div className="flex-1 flex justify-between sm:hidden">
                <button
                    onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-4 py-2 border border-white/10 text-sm font-medium rounded-md text-slate-300 bg-[#0d0d1a] hover:bg-white/5 disabled:opacity-50"
                >
                    Previous
                </button>
                <button
                    onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-white/10 text-sm font-medium rounded-md text-slate-300 bg-[#0d0d1a] hover:bg-white/5 disabled:opacity-50"
                >
                    Next
                </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                    <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">
                        Page <span className="text-white">{currentPage}</span> of <span className="text-white">{totalPages}</span>
                    </p>
                </div>
                <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                        <button
                            onClick={() => onPageChange(currentPage - 1)}
                            disabled={currentPage === 1}
                            className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-white/10 bg-[#0d0d1a] text-sm font-medium text-slate-500 hover:bg-white/5 disabled:opacity-50 transition-all"
                        >
                            <span className="sr-only">Previous</span>
                            <ChevronLeftIcon className="h-4 h-4" aria-hidden="true" />
                        </button>
                        
                        {pages.map(page => (
                            <button
                                key={page}
                                onClick={() => onPageChange(page)}
                                className={`relative inline-flex items-center px-4 py-2 border border-white/10 text-[10px] font-black uppercase tracking-widest transition-all ${
                                    currentPage === page 
                                    ? 'z-10 bg-blue-600 text-white border-blue-600' 
                                    : 'bg-[#0d0d1a] text-slate-400 hover:bg-white/5'
                                }`}
                            >
                                {page}
                            </button>
                        ))}

                        <button
                            onClick={() => onPageChange(currentPage + 1)}
                            disabled={currentPage === totalPages}
                            className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-white/10 bg-[#0d0d1a] text-sm font-medium text-slate-500 hover:bg-white/5 disabled:opacity-50 transition-all"
                        >
                            <span className="sr-only">Next</span>
                            <ChevronRightIcon className="h-4 h-4" aria-hidden="true" />
                        </button>
                    </nav>
                </div>
            </div>
        </div>
    );
}
