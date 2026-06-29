import React, { useEffect, useState } from 'react';
import { Download, X, CheckSquare, AlertCircle } from 'lucide-react';

export default function InstallPWA() {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const [supportsPWA, setSupportsPWA] = useState(false);
  const [promptInstall, setPromptInstall] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    const handler = (e: any) => {
      e.preventDefault();
      setSupportsPWA(true);
      setPromptInstall(e);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // If it's iOS and not already in standalone mode, we can show instructions
    if (isIOSDevice && !(window.navigator as any).standalone) {
      setSupportsPWA(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const onClick = (evt: any) => {
    evt.preventDefault();
    if (isIOS) {
      showToast('To install EduNexus on your iPhone: Tap the Share button in Safari (square with up arrow) and select "Add to Home Screen".', 'info');
      return;
    }
    if (!promptInstall) return;
    promptInstall.prompt();
  };

  if (!supportsPWA && !toast) return null;

  return (
    <>
      {toast && (
        <div className={`fixed top-6 right-6 z-[110] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-xl text-white text-sm font-bold transition-all ${
          toast.type === 'success' ? 'bg-emerald-600' :
          toast.type === 'error' ? 'bg-rose-600' :
          'bg-blue-600'
        }`}>
          {toast.type === 'success' ? <CheckSquare size={18} /> :
           toast.type === 'error' ? <AlertCircle size={18} /> :
           <AlertCircle size={18} />}
          {toast.message}
        </div>
      )}
      {!dismissed && supportsPWA && (
        <div className="fixed bottom-6 left-6 right-6 md:left-auto md:right-8 md:w-80 bg-blue-600 text-white p-4 rounded-2xl shadow-2xl z-[100] animate-in fade-in slide-in-from-bottom duration-500">
          <div className="flex items-start gap-3">
            <div className="bg-white/20 p-2 rounded-xl">
              <Download size={24} />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-sm">Install EduNexus</h3>
              <p className="text-xs text-blue-100 mt-1">Get the app for a better experience and offline access.</p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={onClick}
                  className="bg-white text-blue-600 px-4 py-2 rounded-lg text-xs font-bold hover:bg-blue-50 transition-colors"
                >
                  Install Now
                </button>
                <button
                  onClick={() => setDismissed(true)}
                  className="px-3 py-2 text-xs font-medium hover:bg-white/10 rounded-lg transition-colors"
                >
                  Maybe later
                </button>
              </div>
            </div>
            <button
              onClick={() => setDismissed(true)}
              className="text-white/60 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
