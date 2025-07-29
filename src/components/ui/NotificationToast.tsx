import React, { useEffect } from 'react';
import { Notification } from '../../types';
import { Icon } from './Icon';
import { SEVERITY_INFO } from '../../constants';

interface NotificationToastProps {
  notification: Notification;
  onClose: () => void;
}

export const NotificationToast: React.FC<NotificationToastProps> = ({ notification, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 5000); // Auto-dismiss after 5 seconds

    return () => {
      clearTimeout(timer);
    };
  }, [onClose]);

  const severityStyles = SEVERITY_INFO[notification.severity];

  return (
    <div className="max-w-sm w-full bg-card shadow-lg rounded-lg pointer-events-auto ring-1 ring-border overflow-hidden">
      <div className="p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <Icon name={severityStyles.icon} className={`h-6 w-6 ${severityStyles.color}`} />
          </div>
          <div className="ml-3 w-0 flex-1 pt-0.5">
            <p className="text-sm font-medium text-foreground">{notification.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{notification.message}</p>
          </div>
          <div className="ml-4 flex-shrink-0 flex">
            <button
              onClick={onClose}
              className="inline-flex rounded-md bg-card text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring"
            >
              <span className="sr-only">Close</span>
              <Icon name="x" className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
