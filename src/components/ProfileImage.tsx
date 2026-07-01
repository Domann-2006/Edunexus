import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Camera, Loader2, User as UserIcon, Image as ImageIcon, X } from 'lucide-react';
import { fileService } from '../services/api';
import imageCompression from 'browser-image-compression';

interface ProfileImageProps {
  url?: string;
  onUpload?: (url: string) => void;
  onUploadingChange?: (uploading: boolean) => void;
  editable?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  folder?: 'students' | 'teachers' | 'schools' | 'profiles';
  showCamera?: boolean;
}

export default function ProfileImage({ 
  url, 
  onUpload, 
  onUploadingChange,
  editable = false, 
  size = 'md', 
  folder = 'profiles',
  showCamera = false
}: ProfileImageProps) {
  const [uploading, setUploading] = useState(false);

  // Sync internal uploading state to parent
  useEffect(() => {
    onUploadingChange?.(uploading);
  }, [uploading, onUploadingChange]);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showOptions, setShowOptions] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const sizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-16 h-16',
    lg: 'w-24 h-24',
    xl: 'w-32 h-32'
  };

  // Memoize UI classes to prevent recalculation on every render
  const containerSize = sizeClasses[size] || sizeClasses.md;

  // Cleanup object URLs to prevent memory leaks
  useEffect(() => {
    return () => {
      if (previewUrl) {
        try {
          URL.revokeObjectURL(previewUrl);
        } catch (e) {
          // Ignore revocation errors
        }
      }
    };
  }, [previewUrl]);

  const handleUpload = async (file: File) => {
    if (!file) return;

    // Type validation
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file.');
      return;
    }

    // Size limit - check original size
    // 15MB is a more conservative limit for mobile stability
    if (file.size > 15 * 1024 * 1024) {
      setError('Image is too large. Please resize it before uploading or choose a smaller one.');
      return;
    }

    setUploading(true);
    setProgress(0);
    setError(null);

    // Create a local scope for URLs to ensure they are cleaned up
    let primaryObjectUrl: string | null = null;
    let compressedObjectUrl: string | null = null;

    try {
      // Skip preview before compression — saves memory on low RAM devices
      // Preview will be set after compression succeeds

      // Give the UI a chance to update before heavy compression starts
      await new Promise(resolve => setTimeout(resolve, 200));

      // Compression options - optimized for low-memory environments
      const options = {
        maxSizeMB: 0.3,        // Target 300KB
        maxWidthOrHeight: 600, // Smaller dimension for low RAM phones
        useWebWorker: true,    // Keeps compression off the main thread
        initialQuality: 0.5,
        alwaysKeepResolution: false,
        signal: undefined,
      };

      let fileToUpload = file;
      try {
        const compressedFile = await imageCompression(file, options);
        fileToUpload = compressedFile;
        
        // Show compressed version and revoke old preview
        compressedObjectUrl = URL.createObjectURL(compressedFile);
        setPreviewUrl(compressedObjectUrl);
        
        if (primaryObjectUrl) {
          URL.revokeObjectURL(primaryObjectUrl);
          primaryObjectUrl = null;
        }
      } catch (compressionErr) {
        console.warn('Compression failed or skipped, uploading original', compressionErr);
        // Fallback preview if we didn't set one earlier
        if (!primaryObjectUrl) {
          primaryObjectUrl = URL.createObjectURL(file);
          setPreviewUrl(primaryObjectUrl);
        }
      }

      // Upload to server
      const res = await fileService.upload(fileToUpload, folder, (p) => setProgress(p));
      onUpload?.(res.data.url);
      setShowOptions(false);
    } catch (err: any) {
      console.error('Task failed:', err);
      setError(err.message || 'Processing failed. Device may be low on memory.');
    } finally {
      // Small delay before clearing upload state for smoother transition
      setTimeout(() => {
        setUploading(false);
        setProgress(0);
        setPreviewUrl(null);
      }, 500);
      
      // We keep the last previewUrl (compressedObjectUrl) until component unmounts or next upload
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    const file = e.target.files?.[0];
    if (file) {
      // Pass directly to handleUpload — compression handled there via Web Worker
      handleUpload(file);
    }
    // Reset input value so same file can be selected again
    e.target.value = '';
  };

  const currentImageUrl = previewUrl || url;

  // Render hidden inputs in a portal at the end of body to avoid form interference
  const renderHiddenInputs = () => {
    return createPortal(
      <div className="hidden" aria-hidden="true">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          onClick={(e) => e.stopPropagation()}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          onClick={(e) => e.stopPropagation()}
        />
      </div>,
      document.body
    );
  };

  return (
    <div className="flex flex-col items-center gap-2">
      {renderHiddenInputs()}
      <div className={`relative group ${containerSize}`}>
        <div className="w-full h-full rounded-2xl overflow-hidden bg-gray-100 border border-gray-100 flex items-center justify-center shadow-sm relative">
          {currentImageUrl ? (
            <img 
              src={currentImageUrl} 
              alt="Profile" 
              className="w-full h-full object-cover" 
              referrerPolicy="no-referrer" 
            />
          ) : (
            <UserIcon className="text-gray-300" size={size === 'xl' ? 48 : 24} />
          )}
          
          {uploading && (
            <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white backdrop-blur-[2px] z-10">
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

        {editable && !uploading && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              showCamera ? setShowOptions(true) : fileInputRef.current?.click();
            }}
            className="absolute inset-0 bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl"
          >
            <Camera size={20} />
          </button>
        )}
      </div>

      {error && <span className="text-[10px] text-red-500 font-bold text-center px-2">{error}</span>}


      {/* Mobile-friendly Options Modal */}
      {showOptions && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowOptions(false);
            }}
          />
          <div className="relative w-full max-w-sm bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-sm font-black uppercase tracking-widest text-gray-900">Select Image</h3>
                <button 
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowOptions(false);
                  }}
                  className="p-2 text-gray-400 hover:bg-gray-50 rounded-full"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    cameraInputRef.current?.click();
                  }}
                  className="flex flex-col items-center justify-center gap-3 p-6 bg-blue-50 border border-blue-100 rounded-2xl text-blue-600 hover:bg-blue-100 transition-all font-bold group"
                >
                  <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center group-active:scale-95 transition-transform">
                    <Camera size={24} />
                  </div>
                  <span className="text-xs uppercase tracking-tighter">Take Photo</span>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className="flex flex-col items-center justify-center gap-3 p-6 bg-purple-50 border border-purple-100 rounded-2xl text-purple-600 hover:bg-purple-100 transition-all font-bold group"
                >
                  <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center group-active:scale-95 transition-transform">
                    <ImageIcon size={24} />
                  </div>
                  <span className="text-xs uppercase tracking-tighter">Gallery</span>
                </button>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowOptions(false);
                }}
                className="w-full mt-4 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest hover:bg-gray-50 rounded-2xl transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
