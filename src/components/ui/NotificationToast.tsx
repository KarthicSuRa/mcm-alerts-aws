import React from 'react';
import { Icon } from './Icon';
import { Notification, Severity } from '../../types';

interface NotificationToastProps {
  notification: Notification;
  onClose: () => void;
}

const severityStyles: Record<Severity, { bg: string; icon: string; iconColor: string }> = {
    low: { bg: 'bg-blue-50', icon: 'info', iconColor: 'text-blue-400' },
    medium: { bg: 'bg-yellow-50', icon: 'alert-triangle', iconColor: 'text-yellow-400' },
    high: { bg: 'bg-red-50', icon: 'alert-circle', iconColor: 'text-red-400' },
};

export const NotificationToast: React.FC<NotificationToastProps> = ({ notification, onClose }) => {
    const styles = severityStyles[notification.severity] || severityStyles.medium;

    return (
      <div className={`max-w-sm w-full ${styles.bg} shadow-lg rounded-lg pointer-events-auto ring-1 ring-black ring-opacity-5 overflow-hidden`}>
        <div className="p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <Icon name={styles.icon} className={`h-6 w-6 ${styles.iconColor}`} />
            </div>
            <div className="ml-3 w-0 flex-1 pt-0.5">
              <p className="text-sm font-medium text-gray-900">{notification.title}</p>
              <p className="mt-1 text-sm text-gray-500">{notification.message}</p>
            </div>
            <div className="ml-4 flex-shrink-0 flex">
              <button
                onClick={onClose}
                className="bg-transparent rounded-md inline-flex text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <span className="sr-only">Close</span>
                <Icon name="close" className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };
  