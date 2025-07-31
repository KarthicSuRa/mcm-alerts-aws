import React, { useEffect, useState } from 'react';
import { Notification } from '../../types';
import { Icon } from './Icon';
import { SEVERITY_INFO } from '../../constants';

interface NotificationToastProps {
  notification: Notification;
  onClose: () => void;
}

export const NotificationToast: React.FC<NotificationToastProps> = ({ notification, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Trigger entrance animation
    const showTimer = setTimeout(() => {
      setIsVisible(true);
    }, 10);

    // Auto-dismiss after 5 seconds
    const dismissTimer = setTimeout(() => {
      handleClose();
    }, 5000);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(dismissTimer);
    };
  }, []);

  const handleClose = () => {
    setIsExiting(true);
    // Wait for exit animation to complete
    setTimeout(() => {
      onClose();
    }, 300);
  };

  const severityStyles = SEVERITY_INFO[notification.severity];

  return (
    <div 
      className={`
        max-w-sm w-full bg-card shadow-lg rounded-lg pointer-events-auto ring-1 ring-border overflow-hidden
        transform transition-all duration-300 ease-in-out
        ${isVisible && !isExiting 
          ? 'translate-x-0 opacity-100 scale-100' 
          : isExiting 
            ? 'translate-x-full opacity-0 scale-95' 
            : 'translate-x-full opacity-0 scale-95'
        }
        
        /* Mobile-specific styles */
        sm:max-w-sm
        max-w-[calc(100vw-2rem)]
        
        /* Enhanced mobile browser support */
        -webkit-transform: ${isVisible && !isExiting ? 'translateX(0)' : 'translateX(100%)'};
        -moz-transform: ${isVisible && !isExiting ? 'translateX(0)' : 'translateX(100%)'};
        -ms-transform: ${isVisible && !isExiting ? 'translateX(0)' : 'translateX(100%)'};
        
        /* Ensure proper layering on mobile */
        z-index: 9999;
        
        /* Handle safe areas on mobile */
        margin-right: env(safe-area-inset-right, 0);
        margin-bottom: env(safe-area-inset-bottom, 0);
      `}
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
    >
      <div className="p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <Icon 
              name={severityStyles.icon} 
              className={`h-6 w-6 ${severityStyles.color}`} 
              aria-hidden="true"
            />
          </div>
          <div className="ml-3 w-0 flex-1 pt-0.5">
            <p className="text-sm font-medium text-foreground">
              {notification.title}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {notification.message}
            </p>
            {notification.topic_id && (
              <p className="mt-1 text-xs text-muted-foreground opacity-75">
                {new Date(notification.created_at || notification.timestamp).toLocaleTimeString()}
              </p>
            )}
          </div>
          <div className="ml-4 flex-shrink-0 flex">
            <button
              onClick={handleClose}
              className="
                inline-flex rounded-md bg-card text-muted-foreground 
                hover:text-foreground focus:outline-none focus:ring-2 
                focus:ring-offset-2 focus:ring-ring transition-colors
                /* Enhanced touch targets for mobile */
                min-w-[44px] min-h-[44px] items-center justify-center
                sm:min-w-auto sm:min-h-auto
              "
              aria-label="Close notification"
              type="button"
            >
              <span className="sr-only">Close</span>
              <Icon name="x" className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
      
      {/* Progress bar for auto-dismiss */}
      <div className="h-1 bg-muted">
        <div 
          className={`
            h-full bg-primary transition-all duration-[5000ms] ease-linear
            ${isVisible && !isExiting ? 'w-0' : 'w-full'}
          `}
        />
      </div>
    </div>
  );
};

/* CSS-in-JS styles for better mobile browser support */
const toastStyles = `
  @supports (-webkit-touch-callout: none) {
    /* iOS Safari specific styles */
    .notification-toast {
      -webkit-transform: translate3d(0, 0, 0);
      transform: translate3d(0, 0, 0);
    }
  }
  
  @media (max-width: 640px) {
    /* Mobile-specific toast positioning */
    .notification-toast {
      margin-left: 1rem;
      margin-right: 1rem;
      max-width: calc(100vw - 2rem);
    }
  }
  
  /* Ensure proper stacking on all browsers */
  .toast-container {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    pointer-events: none;
    z-index: 9999;
  }
  
  /* Animation keyframes for cross-browser compatibility */
  @keyframes slideInFromRight {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOutToRight {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }
`;

// Inject styles into document head
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = toastStyles;
  document.head.appendChild(styleElement);
}
