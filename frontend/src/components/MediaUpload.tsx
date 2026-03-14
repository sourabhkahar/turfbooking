'use client';
import { useState, useRef } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { 
    PhotoIcon, 
    XMarkIcon,
    ArrowUpTrayIcon,
    ArrowPathIcon,
    PlusCircleIcon,
    PlayIcon,
    ChevronLeftIcon,
    ChevronRightIcon
} from '@heroicons/react/24/outline';

interface MediaItem {
    url: string;
    type: 'image' | 'video';
}

interface MediaUploadProps {
    value: MediaItem[];
    onChange: (value: MediaItem[]) => void;
    maxFiles?: number;
}

export default function MediaUpload({ value = [], onChange, maxFiles = 10 }: MediaUploadProps) {
    const [uploading, setUploading] = useState(false);
    const [activeIndex, setActiveIndex] = useState<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const getFullUrl = (url: string) => {
        const baseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace('/api', '');
        return `${baseUrl}${url}`;
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        if (value.length + files.length > maxFiles) {
            toast.error(`Maximum ${maxFiles} files allowed`);
            return;
        }

        setUploading(true);
        const newMedia = [...value];

        try {
            for (let i = 0; i < files.length; i++) {
                const formData = new FormData();
                formData.append('file', files[i]);

                const { data } = await api.post('/upload', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });

                newMedia.push({
                    url: data.url,
                    type: data.type
                });
            }
            onChange(newMedia);
            toast.success('Media uploaded successfully');
        } catch (err: unknown) {
            const error = err as { response?: { data?: { message?: string } } };
            toast.error(error.response?.data?.message || 'Upload failed');
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const removeMedia = (e: React.MouseEvent, index: number) => {
        e.stopPropagation();
        const newMedia = [...value];
        newMedia.splice(index, 1);
        onChange(newMedia);
    };

    return (
        <div className="space-y-4 w-full">
            <div className="flex items-center justify-between">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Turf Gallery ({value.length}/{maxFiles})</label>
                <button 
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex items-center gap-2 text-[10px] font-bold text-green-500 hover:text-green-400 transition-colors uppercase tracking-widest"
                >
                    {uploading ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <ArrowUpTrayIcon className="w-4 h-4" />}
                    Add Media
                </button>
            </div>

            <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleUpload}
                accept="image/*,video/*"
                multiple
                className="hidden"
            />

            {value.length === 0 && !uploading && (
                <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-white/10 rounded-2xl p-12 flex flex-col items-center justify-center gap-4 hover:border-green-500/50 hover:bg-green-500/5 transition-all cursor-pointer group"
                >
                    <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <PhotoIcon className="w-8 h-8 text-slate-500 group-hover:text-green-500" />
                    </div>
                    <p className="text-slate-500 text-xs font-medium text-center">
                        Upload photos and videos of your turf.<br/>
                        <span className="text-[10px] uppercase font-black tracking-widest text-slate-600">JPG, PNG, MP4 supported</span>
                    </p>
                </div>
            )}

            {value.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {value.map((item, index) => (
                        <div 
                            key={index} 
                            onClick={() => setActiveIndex(index)}
                            className="relative aspect-square rounded-xl overflow-hidden group border border-white/10 bg-slate-900 cursor-pointer"
                        >
                            {item.type === 'image' ? (
                                <img 
                                    src={getFullUrl(item.url)} 
                                    className="w-full h-full object-cover transition-transform group-hover:scale-110" 
                                    alt="Turf" 
                                />
                            ) : (
                                <div className="w-full h-full relative">
                                    <video 
                                        src={getFullUrl(item.url)}
                                        className="w-full h-full object-cover"
                                    />
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white">
                                        <PlayIcon className="w-8 h-8 opacity-70" />
                                    </div>
                                </div>
                            )}
                            
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <button 
                                    type="button"
                                    onClick={(e) => removeMedia(e, index)}
                                    className="absolute top-2 right-2 p-2 bg-red-500 rounded-full text-white hover:scale-110 transition-transform z-10 shadow-lg"
                                >
                                    <XMarkIcon className="w-3 h-3" />
                                </button>
                                <span className="text-[10px] text-white font-black uppercase tracking-widest">Click to View</span>
                            </div>

                            {item.type === 'video' && (
                                <div className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded bg-black/60 text-[8px] font-black text-white uppercase tracking-widest">
                                    Video
                                </div>
                            )}
                        </div>
                    ))}
                    
                    {value.length < maxFiles && (
                        <button 
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="aspect-square rounded-xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-2 hover:border-green-500/50 hover:bg-green-500/5 transition-all text-slate-500 hover:text-green-500"
                        >
                            <PlusCircleIcon className="w-6 h-6" />
                            <span className="text-[10px] uppercase font-black tracking-widest">Add More</span>
                        </button>
                    )}
                </div>
            )}

            {uploading && (
                <div className="flex items-center gap-3 p-4 bg-green-500/10 rounded-xl border border-green-500/20">
                    <ArrowPathIcon className="w-4 h-4 text-green-500 animate-spin" />
                    <p className="text-green-400 text-[10px] font-black uppercase tracking-widest">Processing uploads...</p>
                </div>
            )}

            {/* Lightbox / Popup */}
            {activeIndex !== null && (
                <div className="fixed inset-0 z-[500] bg-black/95 backdrop-blur-xl flex items-center justify-center animate-fade-in p-4 sm:p-10">
                    <button 
                        onClick={() => setActiveIndex(null)}
                        className="absolute top-6 right-6 p-3 bg-white/10 rounded-full text-white hover:bg-red-500 transition-colors z-10"
                    >
                        <XMarkIcon className="w-6 h-6" />
                    </button>

                    <button 
                        onClick={() => setActiveIndex(activeIndex > 0 ? activeIndex - 1 : value.length - 1)}
                        className="absolute left-6 p-4 text-white hover:text-green-500 transition-colors hidden sm:block"
                    >
                        <ChevronLeftIcon className="w-10 h-10" />
                    </button>

                    <div className="max-w-5xl w-full h-full flex items-center justify-center relative">
                        {value[activeIndex].type === 'image' ? (
                            <img 
                                src={getFullUrl(value[activeIndex].url)} 
                                alt="Full View" 
                                className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl"
                            />
                        ) : (
                            <video 
                                src={getFullUrl(value[activeIndex].url)} 
                                controls 
                                autoPlay
                                className="max-w-full max-h-full rounded-2xl shadow-2xl"
                            />
                        )}
                        
                        <div className="absolute -bottom-10 left-0 right-0 text-center">
                            <span className="text-slate-500 text-xs font-black uppercase tracking-widest">
                                {activeIndex + 1} / {value.length} — {value[activeIndex].type}
                            </span>
                        </div>
                    </div>

                    <button 
                        onClick={() => setActiveIndex(activeIndex < value.length - 1 ? activeIndex + 1 : 0)}
                        className="absolute right-6 p-4 text-white hover:text-green-500 transition-colors hidden sm:block"
                    >
                        <ChevronRightIcon className="w-10 h-10" />
                    </button>
                </div>
            )}
        </div>
    );
}
