'use client';
import { useState } from 'react';
import { PlayIcon, XMarkIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

interface MediaItem {
    url: string;
    type: 'image' | 'video';
}

interface MediaGalleryProps {
    media: MediaItem[];
}

export default function MediaGallery({ media }: MediaGalleryProps) {
    const [activeIndex, setActiveIndex] = useState<number | null>(null);

    if (!media || media.length === 0) return null;

    const getFullUrl = (url: string) => {
        const baseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace('/api', '');
        return `${baseUrl}${url}`;
    };

    return (
        <div className="space-y-4">
            {/* Masonry/Grid View */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 auto-rows-[150px] md:auto-rows-[200px]">
                {media.slice(0, 5).map((item, index) => {
                    // Span logic for masonry effect
                    const isLarge = index === 0;
                    const isWide = index === 3;
                    
                    return (
                        <div 
                            key={index}
                            onClick={() => setActiveIndex(index)}
                            className={`relative rounded-3xl overflow-hidden cursor-pointer group border border-white/10 bg-slate-900 
                                ${isLarge ? 'md:col-span-2 md:row-span-2' : ''} 
                                ${isWide ? 'md:col-span-2' : ''}`}
                        >
                            {item.type === 'image' ? (
                                <img 
                                    src={getFullUrl(item.url)} 
                                    alt="Turf" 
                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                />
                            ) : (
                                <div className="w-full h-full relative">
                                    <video 
                                        src={getFullUrl(item.url)} 
                                        className="w-full h-full object-cover"
                                    />
                                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                                        <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 group-hover:scale-110 transition-transform">
                                            <PlayIcon className="w-6 h-6 text-white fill-white" />
                                        </div>
                                    </div>
                                </div>
                            )}
                            
                            <div className="absolute inset-0 bg-green-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                            
                            {/* Remaining count on last visible item */}
                            {index === 4 && media.length > 5 && (
                                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                    <span className="text-2xl font-black text-white">+{media.length - 4}</span>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Slider/Modal Overlay */}
            {activeIndex !== null && (
                <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-xl flex items-center justify-center animate-fade-in p-4 sm:p-10">
                    <button 
                        onClick={() => setActiveIndex(null)}
                        className="absolute top-6 right-6 p-3 bg-white/10 rounded-full text-white hover:bg-red-500 transition-colors z-10"
                    >
                        <XMarkIcon className="w-6 h-6" />
                    </button>

                    <button 
                        onClick={() => setActiveIndex(activeIndex > 0 ? activeIndex - 1 : media.length - 1)}
                        className="absolute left-6 p-4 text-white hover:text-green-500 transition-colors hidden sm:block"
                    >
                        <ChevronLeftIcon className="w-10 h-10" />
                    </button>

                    <div className="max-w-5xl w-full h-full flex items-center justify-center relative">
                        {media[activeIndex].type === 'image' ? (
                            <img 
                                src={getFullUrl(media[activeIndex].url)} 
                                alt="Full View" 
                                className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl"
                            />
                        ) : (
                            <video 
                                src={getFullUrl(media[activeIndex].url)} 
                                controls 
                                autoPlay
                                className="max-w-full max-h-full rounded-2xl shadow-2xl"
                            />
                        )}
                        
                        <div className="absolute -bottom-10 left-0 right-0 text-center">
                            <span className="text-slate-500 text-xs font-black uppercase tracking-widest">
                                {activeIndex + 1} / {media.length} — {media[activeIndex].type}
                            </span>
                        </div>
                    </div>

                    <button 
                        onClick={() => setActiveIndex(activeIndex < media.length - 1 ? activeIndex + 1 : 0)}
                        className="absolute right-6 p-4 text-white hover:text-green-500 transition-colors hidden sm:block"
                    >
                        <ChevronRightIcon className="w-10 h-10" />
                    </button>
                    
                    {/* Mobile Thumbnails */}
                    <div className="absolute bottom-10 left-0 right-0 flex justify-center gap-2 px-4 overflow-x-auto sm:hidden">
                        {media.map((_, idx) => (
                            <div 
                                key={idx}
                                className={`w-2 h-2 rounded-full transition-all ${idx === activeIndex ? 'bg-green-500 w-4' : 'bg-white/20'}`}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
