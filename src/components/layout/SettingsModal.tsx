import React, { useState } from 'react';
import { Icon } from '../ui/Icon';
import { Switch } from '../ui/Switch';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  snoozedUntil: Date | null;
  setSnoozedUntil: (date: Date | null) => void;
  isPushEnabled: boolean;
  isPushLoading: boolean;
  onSubscribeToPush: () => Promise<void>;
  onUnsubscribeFromPush: () => Promise<void>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  soundEnabled,
  setSoundEnabled,
  snoozedUntil,
  setSnoozedUntil,
  isPushEnabled,
  isPushLoading,
  onSubscribeToPush,
  onUnsubscribeFromPush,
}) => {
  // FIX: Add a local loading state for the toggle action
  const [isToggleLoading, setIsToggleLoading] = useState(false);

  if (!isOpen) return null;

  const handleSnooze = (minutes: number) => {
    if (minutes === 0) {
        setSnoozedUntil(null);
    } else {
        const newSnoozeTime = new Date();
        newSnoozeTime.setMinutes(newSnoozeTime.getMinutes() + minutes);
        setSnoozedUntil(newSnoozeTime);
    }
    onClose();
  };

  // FIX: Make the handler async and manage local loading state
  const handlePushToggle = async () => {
    if (isToggleLoading) return; // Prevent multiple clicks
    setIsToggleLoading(true);

    try {
      if (isPushEnabled) {
        await onUnsubscribeFromPush();
      } else {
        await onSubscribeToPush();
      }
    } finally {
      setIsToggleLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex justify-center items-center z-50" onClick={onClose}>
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-gray-200">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-gray-900">Application Settings</h2>
                    <button 
                        onClick={onClose} 
                        className="p-2 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                    >
                        <span className="sr-only">Close</span>
                        <Icon name="close" className="w-5 h-5" />
                    </button>
                </div>
                <p className="text-sm text-gray-500 mt-1">Manage your notification preferences.</p>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
                {/* Sound Settings */}
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="font-semibold text-gray-800">Notification Sounds</h3>
                        <p className="text-sm text-gray-500">Play a sound for new high-priority alerts.</p>
                    </div>
                    <Switch 
                        checked={soundEnabled} 
                        onChange={() => setSoundEnabled(!soundEnabled)} 
                    />
                </div>

                {/* Push Notifications */}
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="font-semibold text-gray-800">Push Notifications</h3>
                        <p className="text-sm text-gray-500">Receive alerts even when the app is in the background.</p>
                    </div>
                    <Switch 
                        checked={isPushEnabled} 
                        onChange={handlePushToggle}
                        // FIX: Disable the toggle during the async operation
                        disabled={isPushLoading || isToggleLoading}
                    />
                </div>

                {/* Snooze Notifications */}
                <div>
                    <h3 className="font-semibold text-gray-800 mb-2">Snooze Alerts</h3>
                    <p className="text-sm text-gray-500 mb-3">Temporarily pause all incoming notification sounds and toasts.</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <button onClick={() => handleSnooze(15)} className="snooze-button">15 Mins</button>
                        <button onClick={() => handleSnooze(60)} className="snooze-button">1 Hour</button>
                        <button onClick={() => handleSnooze(240)} className="snooze-button">4 Hours</button>
                        <button onClick={() => handleSnooze(0)} className="snooze-button-cancel">Clear</button>
                    </div>
                    {snoozedUntil && (
                        <p className="text-sm text-green-600 mt-3 text-center">Alerts are snoozed until {snoozedUntil.toLocaleTimeString()}</p>
                    )}
                </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-gray-50 rounded-b-xl text-right">
                <button 
                    onClick={onClose} 
                    className="px-5 py-2.5 bg-blue-600 text-white font-semibold rounded-lg text-sm hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-300 transition-colors"
                >
                    Done
                </button>
            </div>
        </div>
    </div>
  );
};
