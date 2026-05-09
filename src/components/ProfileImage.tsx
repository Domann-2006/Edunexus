import React, { useRef, useState } from 'react';
import { Camera, Loader2, User as UserIcon } from 'lucide-react';
import { fileService } from '../services/api';

interface ProfileImageProps {
  url?: string;
  onUpload?: (url: string) => void;
  editable?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  folder?: 'students' | 'teachers' | 'schools' | 'profiles';
  showCamera?: boolean;
}

export default function ProfileImage({ 
  url, 
  onUpload, 
  editable = false, 
  size = 'md', 
  folder = 'profiles',
  showCamera = false
}: ProfileImageProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
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

    // Type validation
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file.');
      return;
    }

    // Size validation (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('File is too large. Max 5MB.');
      return;
    }

    setUploading(true);
    setProgress(0);
    setError(null);

    try {
      const res = await fileService.upload(file, folder, (p) => setProgress(p));
      onUpload?.(res.data.url);
    } catch (err: any) {
      console.error('Upload failed', err);
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`relative group ${sizeClasses[size]}`}>
        <div className="w-full h-full rounded-2xl overflow-hidden bg-gray-100 border border-gray-100 flex items-center justify-center shadow-sm relative">
          {url ? (
            <img src={url} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <UserIcon className="text-gray-300" size={size === 'xl' ? 48 : 24} />
          )}
          
          {uploading && (
            <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white backdrop-blur-[2px]">
              <Loader2 className="animate-spin mb-1 text-blue-400" size={size === 'xl' ? 32 : 20} />
              <div className="w-4/5 bg-white/20 h-1 rounded-full overflow-hidden mt-2">
                <div 
                  className="bg-blue-500 h-full transition-all duration-300" 
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-[10px] font-bold mt-1">{Math.round(progress)}%</span>
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
            capture={showCamera ? 'environment' : undefined}
            onChange={handleFileChange}
          />
        )}
      </div>
      {error && <span className="text-[10px] text-red-500 font-bold text-center px-2">{error}</span>}
    </div>
  );
}
