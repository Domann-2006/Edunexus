import React, { useRef, useState } from 'react';
import { Camera, Loader2, User as UserIcon } from 'lucide-react';
import { fileService } from '../services/api';

interface ProfileImageProps {
  url?: string;
  onUpload?: (url: string) => void;
  editable?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  folder?: 'students' | 'teachers' | 'schools' | 'profiles';
}

export default function ProfileImage({ url, onUpload, editable = false, size = 'md', folder = 'profiles' }: ProfileImageProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-16 h-16',
    lg: 'w-24 h-24',
    xl: 'w-32 h-32'
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('File is too large. Max 2MB.');
      return;
    }

    setUploading(true);
    setProgress(0);
    try {
      const res = await fileService.upload(file, folder, (p) => setProgress(p));
      onUpload?.(res.data.url);
    } catch (err: any) {
      console.error('Upload failed', err);
      alert(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <div className={`relative group ${sizeClasses[size]}`}>
      <div className="w-full h-full rounded-2xl overflow-hidden bg-gray-100 border border-gray-100 flex items-center justify-center shadow-sm relative">
        {url ? (
          <img src={url} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <UserIcon className="text-gray-300" size={size === 'xl' ? 48 : 24} />
        )}
        
        {uploading && (
          <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white">
            <Loader2 className="animate-spin mb-1" size={size === 'xl' ? 32 : 20} />
            <span className="text-[10px] font-bold">{Math.round(progress)}%</span>
          </div>
        )}
      </div>

      {editable && (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="absolute inset-0 bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl"
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="animate-spin" size={20} />
          ) : (
            <Camera size={20} />
          )}
        </button>
      )}

      {editable && (
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/*"
          onChange={handleFileChange}
        />
      )}
    </div>
  );
}
