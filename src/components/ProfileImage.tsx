import React, { useRef, useState } from 'react';
import { Camera, Loader2, User as UserIcon } from 'lucide-react';
import { fileService } from '../services/api';

interface ProfileImageProps {
  url?: string;
  onUpload?: (url: string) => void;
  editable?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export default function ProfileImage({ url, onUpload, editable = false, size = 'md' }: ProfileImageProps) {
  const [uploading, setUploading] = useState(false);
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

    setUploading(true);
    try {
      const res = await fileService.upload(file);
      onUpload?.(res.data.url);
    } catch (err) {
      console.error('Upload failed', err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={`relative group ${sizeClasses[size]}`}>
      <div className="w-full h-full rounded-2xl overflow-hidden bg-gray-100 border border-gray-100 flex items-center justify-center shadow-sm">
        {url ? (
          <img src={url} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <UserIcon className="text-gray-300" size={size === 'xl' ? 48 : 24} />
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
