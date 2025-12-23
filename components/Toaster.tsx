import React, { useEffect, useState } from 'react';
import { X, CheckCircle2, AlertTriangle, Info } from 'lucide-react';

interface Toast {
  id: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
}

export const Toaster: React.FC = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const onToast = (e: any) => {
      const detail = e?.detail || {};
      const t: Toast = {
        id: detail.id || String(Date.now()) + Math.random().toString(36).slice(2),
        message: detail.message || '',
        type: detail.type || 'info'
      };
      setToasts(prev => [t, ...prev]);
      // auto-remove
      setTimeout(() => {
        setToasts(prev => prev.filter(x => x.id !== t.id));
      }, detail.duration || 5000);
    };
    window.addEventListener('app-toast', onToast as EventListener);
    return () => window.removeEventListener('app-toast', onToast as EventListener);
  }, []);

  const remove = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));

  const getIcon = (type?: Toast['type']) => {
    switch(type) {
      case 'success': return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-amber-400" />;
      default: return <Info className="w-4 h-4 text-blue-400" />;
    }
  };

  return (
    <div style={{ zIndex: 2147483647 }} className="fixed top-4 right-4 flex flex-col gap-3 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className="flex items-start gap-3 bg-[#0f1724] border border-white/10 p-3 rounded-lg shadow-lg max-w-md pointer-events-auto">
          <div className="pt-0.5">{getIcon(t.type)}</div>
          <div className="flex-1">
            <div className="text-sm text-white">{t.message}</div>
          </div>
          <button onClick={() => remove(t.id)} className="text-gray-400 hover:text-white ml-2"><X className="w-4 h-4" /></button>
        </div>
      ))}
    </div>
  );
};

export default Toaster;
