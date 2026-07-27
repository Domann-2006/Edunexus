import { useState, useEffect, useRef } from 'react';
import { Wifi, WifiOff, WifiLow, X } from 'lucide-react';

type ConnectionState = 'online' | 'offline' | 'weak' | 'restored';

export default function ConnectionStatus() {
  const [status, setStatus] = useState<ConnectionState | null>(null);
  const [visible, setVisible] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearHideTimer = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  };

  const scheduleHide = (delay: number) => {
    clearHideTimer();
    hideTimer.current = setTimeout(() => setVisible(false), delay);
  };

  const checkConnectionQuality = async (): Promise<'online' | 'weak'> => {
    try {
      const start = Date.now();
      await fetch(`${import.meta.env.VITE_API_URL || '/api'}/health`, {
        method: 'GET',
        cache: 'no-store',
        signal: AbortSignal.timeout(3000),
      });
      const latency = Date.now() - start;
      return latency > 1500 ? 'weak' : 'online';
    } catch {
      return 'weak';
    }
  };

  const showBanner = (s: ConnectionState, autoDismiss?: number) => {
    setStatus(s);
    setVisible(true);
    clearHideTimer();
    if (autoDismiss) scheduleHide(autoDismiss);
  };

  useEffect(() => {
    const handleOffline = () => {
      showBanner('offline');
    };

    const handleOnline = async () => {
      showBanner('restored', 3000);
      // After restored banner, check quality
      const quality = await checkConnectionQuality();
      if (quality === 'weak') {
        showBanner('weak');
      } else {
        scheduleHide(3000);
      }
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    // Periodic quality check every 30 seconds when online
    pingInterval.current = setInterval(async () => {
      if (!navigator.onLine) return;
      const quality = await checkConnectionQuality();
      if (quality === 'weak') {
        showBanner('weak');
      } else if (status === 'weak') {
        // Was weak, now strong — show restored briefly
        showBanner('restored', 3000);
      }
    }, 30000);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      if (pingInterval.current) clearInterval(pingInterval.current);
      clearHideTimer();
    };
  }, [status]);

  if (!visible || !status) return null;

  const config = {
    offline: {
      bg: 'bg-gray-800',
      icon: <WifiOff size={16} />,
      text: 'No connection',
      showClose: false,
    },
    restored: {
      bg: 'bg-green-500',
      icon: <Wifi size={16} />,
      text: 'Connection restored',
      showClose: true,
    },
    weak: {
      bg: 'bg-yellow-700',
      icon: <WifiLow size={16} />,
      text: 'Weak connection',
      showClose: true,
    },
    online: {
      bg: 'bg-green-500',
      icon: <Wifi size={16} />,
      text: 'Connected',
      showClose: true,
    },
  }[status];

  return (
    <div className={`w-full px-4 py-2.5 flex items-center justify-between text-white text-sm font-medium ${config.bg} transition-all duration-300`}>
      <div className="flex items-center gap-2">
        {config.icon}
        <span>{config.text}</span>
      </div>
      {config.showClose && (
        <button onClick={() => setVisible(false)} className="opacity-80 hover:opacity-100">
          <X size={16} />
        </button>
      )}
    </div>
  );
}
