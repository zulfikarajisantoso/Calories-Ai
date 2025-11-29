import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, X, Bell } from 'lucide-react';

export interface NotificationState {
  message: string;
  type: 'success' | 'error' | 'info';
  details?: string;
}

interface NotificationToastProps {
  notification: NotificationState | null;
  onClose: () => void;
}

const NotificationToast: React.FC<NotificationToastProps> = ({ notification, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (notification) {
      setIsVisible(true);
      // Auto-dismiss after 5 seconds
      const timer = setTimeout(() => {
        setIsVisible(false);
        // Wait for animation to finish before clearing state
        setTimeout(onClose, 300); 
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [notification, onClose]);

  if (!notification && !isVisible) return null;

  const bgColor = 
    notification?.type === 'success' ? 'bg-emerald-50 border-emerald-200' :
    notification?.type === 'error' ? 'bg-red-50 border-red-200' :
    'bg-blue-50 border-blue-200';

  const iconColor = 
    notification?.type === 'success' ? 'text-emerald-500' :
    notification?.type === 'error' ? 'text-red-500' :
    'text-blue-500';

  return (
    <div 
      className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-sm px-4 transition-all duration-300 ${
        isVisible ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0 pointer-events-none'
      }`}
    >
      <div className={`shadow-lg rounded-xl border p-4 flex items-start gap-3 ${bgColor} backdrop-blur-sm`}>
        <div className={`mt-0.5 ${iconColor}`}>
          {notification?.type === 'success' && <CheckCircle size={20} />}
          {notification?.type === 'error' && <XCircle size={20} />}
          {notification?.type === 'info' && <Bell size={20} />}
        </div>
        
        <div className="flex-1">
          <p className={`text-sm font-semibold ${iconColor.replace('500', '700')}`}>
            {notification?.type === 'success' ? 'Success' : notification?.type === 'error' ? 'Error' : 'Notification'}
          </p>
          <p className="text-sm text-gray-700 mt-1">
            {notification?.message}
          </p>
          {notification?.details && (
            <pre className="mt-2 p-2 bg-white/50 rounded text-xs overflow-x-auto text-gray-600 border border-black/5">
              {notification.details}
            </pre>
          )}
        </div>

        <button onClick={() => setIsVisible(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
          <X size={18} />
        </button>
      </div>
    </div>
  );
};

export default NotificationToast;
