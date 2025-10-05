
import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { addToast } from '../utils/toast';
import { ExtendedNotification } from '../types';

const createToast = (title: string, message: string, onConfirm?: () => void): ExtendedNotification => ({
  id: `sw-toast-${Date.now()}`,
  title,
  message,
  severity: 'low',
  status: 'new',
  type: 'system',
  timestamp: new Date().toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  site: null,
  topic_id: null,
  comments: [],
  onConfirm: onConfirm || (() => {}),
});

export const useServiceWorker = () => {
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);

  const { needRefresh, updateServiceWorker } = useRegisterSW({
    onRegistered: (r) => {
      if (r) {
        console.log('✅ Service Worker registered');
        setInterval(() => {
          console.log('Checking for SW update...');
          r.update();
        }, 3600 * 1000); // Check for updates every hour
      }
    },
    onRegisterError: (error) => {
      console.error('❌ Service Worker registration error', error);
    },
  });

  useEffect(() => {
    if (needRefresh[0]) {
      const toast = createToast(
        'Update Available',
        'A new version of the application is available. Refresh to update.',
        () => updateServiceWorker(true)
      );
      addToast(toast);
      setIsUpdateAvailable(true);
    }
  }, [needRefresh, updateServiceWorker]);

  const handleUpdate = () => {
    if (needRefresh[0]) {
      updateServiceWorker(true);
    }
  };

  return {
    isUpdateAvailable,
    handleUpdate,
  };
};
