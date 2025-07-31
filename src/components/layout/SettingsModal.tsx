import React, { useState, useEffect } from 'react';
import { Icon } from '../ui/Icon';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    soundEnabled: boolean;
    setSoundEnabled: (enabled: boolean) => void;
    snoozedUntil: Date | null;
    setSnoozedUntil: (date: Date | null) => void;
    isPushEnabled: boolean;
    isPushLoading: boolean;
    onSubscribeToPush: () => void;
    onUnsubscribeFromPush: () => void;
}

const ToggleSwitch: React.FC<{ enabled: boolean; onChange: (enabled: boolean) => void }> = ({ enabled, onChange }) => (
    <button
        onClick={() => onChange(!enabled)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 ease-in-out ${enabled ? 'bg-primary' : 'bg-muted'}`}
    >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300 ease-in-out ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
);

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
    onUnsubscribeFromPush
}) => {
    const [permission, setPermission] = useState(window.Notification?.permission);
    const [snoozeTime, setSnoozeTime] = useState<number | null>(null);
    const [isEnabling, setIsEnabling] = useState(false);
    const [debugMode, setDebugMode] = useState(false);

    // Mobile detection
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    useEffect(() => {
        if (!isOpen) return;
        setPermission(window.Notification?.permission);

        if (snoozedUntil && snoozedUntil > new Date()) {
             const diff = snoozedUntil.getTime() - new Date().getTime();
             if (Math.abs(diff - 30*60*1000) < 1000) setSnoozeTime(30);
             else if (Math.abs(diff - 60*60*1000) < 1000) setSnoozeTime(60);
             else if (Math.abs(diff - 4*60*60*1000) < 1000) setSnoozeTime(240);
             else if (Math.abs(diff - 24*60*60*1000) < 1000) setSnoozeTime(1440);
             else setSnoozeTime(null);
        } else {
            setSnoozedUntil(null);
            setSnoozeTime(null);
        }
    }, [isOpen, snoozedUntil, setSnoozedUntil]);

    if (!isOpen) return null;

    const handleRequestNotificationPermission = async () => {
        console.log('🔔 Enable button clicked', { 
            permission, 
            isMobile, 
            notificationSupport: "Notification" in window,
            serviceWorkerSupport: "serviceWorker" in navigator,
            oneSignalLoaded: !!window.OneSignal
        });
        
        if (!("Notification" in window)) {
            alert("This browser does not support desktop notifications");
            return;
        }
        
        if (permission === "denied") {
            alert("Notification permission was denied. Please enable it in your browser settings and refresh the page.");
            return;
        }
        
        setIsEnabling(true);
        
        try {
            // First check if OneSignal is properly initialized
            if (!window.OneSignal) {
                throw new Error('OneSignal not initialized. Please refresh the page and try again.');
            }
            
            // Request permission first
            const newPermission = await window.Notification.requestPermission();
            console.log('Permission result:', newPermission);
            setPermission(newPermission);
            
            if (newPermission === "granted") {
                console.log('🔔 Permission granted, subscribing to push...');
                
                // Add a small delay to ensure OneSignal is ready
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Now subscribe to push notifications
                await onSubscribeToPush();
                
                // Show success message
                console.log('✅ Push notifications enabled successfully');
            } else {
                console.log('Permission not granted:', newPermission);
                alert('Push notifications require permission to be granted.');
            }
        } catch (error) {
            console.error('Error enabling push notifications:', error);
            
            let errorMessage = 'Failed to enable push notifications. ';
            
            if (error.message.includes('OneSignal not initialized')) {
                errorMessage += 'Please refresh the page and try again.';
            } else if (error.message.includes('timeout')) {
                errorMessage += 'Request timed out. Please check your internet connection and try again.';
            } else if (isMobile) {
                errorMessage += 'Mobile browsers may have limited support for web push notifications.';
            } else {
                errorMessage += 'Please check the console for details and ensure you\'re using HTTPS.';
            }
            
            alert(errorMessage);
        } finally {
            setIsEnabling(false);
        }
    };
        
    const getPushComponent = () => {
        if (isPushLoading || isEnabling) {
            return <span className="text-sm font-medium text-muted-foreground">Loading...</span>;
        }
        
        if (permission === 'denied') {
            return (
                <div className="text-right">
                    <span className="text-sm font-medium text-destructive block">Denied in browser</span>
                    <button 
                        onClick={() => alert('Please enable notifications in your browser settings, then refresh the page.')}
                        className="text-xs text-muted-foreground underline mt-1"
                    >
                        How to fix?
                    </button>
                </div>
            );
        }
        
        if (isPushEnabled) {
            return (
                <button 
                    onClick={onUnsubscribeFromPush} 
                    className="px-4 py-2 text-sm font-semibold rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                    Disable
                </button>
            );
        }
        
        return (
            <button 
                onClick={handleRequestNotificationPermission} 
                className="px-4 py-2 text-sm font-semibold rounded-md bg-foreground text-background hover:bg-foreground/90"
                disabled={isEnabling}
            >
                {isEnabling ? 'Enabling...' : 'Enable'}
            </button>
        );
    };

    const handleSnooze = (minutes: number | null) => {
        if (minutes === null) {
            setSnoozedUntil(null);
            setSnoozeTime(null);
        } else {
            const newSnoozeTime = new Date(Date.now() + minutes * 60 * 1000);
            setSnoozedUntil(newSnoozeTime);
            setSnoozeTime(minutes);
        }
    }
    
    const snoozeOptions = [
        { label: '30m', minutes: 30 },
        { label: '1h', minutes: 60 },
        { label: '4h', minutes: 240 },
        { label: '24h', minutes: 1440 },
    ];

    const getSnoozeStatus = () => {
        if (!snoozedUntil || snoozedUntil < new Date()) return null;
        return `Alerts snoozed until ${snoozedUntil.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }

    const DebugInfo = () => (
        <div className="p-4 bg-muted rounded-md text-sm space-y-1">
            <p><strong>Browser:</strong> {isMobile ? 'Mobile' : 'Desktop'}</p>
            <p><strong>Notification Support:</strong> {"Notification" in window ? "✅" : "❌"}</p>
            <p><strong>Service Worker Support:</strong> {"serviceWorker" in navigator ? "✅" : "❌"}</p>
            <p><strong>Current Permission:</strong> {permission}</p>
            <p><strong>OneSignal Loaded:</strong> {window.OneSignal ? "✅" : "❌"}</p>
            <p><strong>Push Enabled:</strong> {isPushEnabled ? "✅" : "❌"}</p>
            {isMobile && (
                <p className="text-yellow-600"><strong>Note:</strong> Mobile web push has limited support</p>
            )}
        </div>
    );

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-card w-full max-w-lg rounded-2xl shadow-xl border border-border" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-6 border-b border-border">
                    <h2 className="text-xl font-bold">Application Settings</h2>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => setDebugMode(!debugMode)}
                            className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground hover:bg-accent"
                        >
                            Debug
                        </button>
                        <button onClick={onClose} className="p-1.5 rounded-full hover:bg-accent">
                            <Icon name="x" className="w-5 h-5" />
                        </button>
                    </div>
                </div>
                <div className="p-6 space-y-6">
                    {debugMode && <DebugInfo />}
                    
                    {/* Push Notifications */}
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-semibold">Desktop Push Alerts</p>
                            <p className="text-sm text-muted-foreground">
                                Receive alerts even when the app is closed.
                                {isMobile && " (Limited mobile support)"}
                            </p>
                        </div>
                        {getPushComponent()}
                    </div>

                    {/* Sound Alerts */}
                    <div className="flex items-center justify-between">
                        <div>
                           <p className="font-semibold">Notification Sounds</p>
                           <p className="text-sm text-muted-foreground">Play a sound for new alerts.</p>
                        </div>
                        <ToggleSwitch enabled={soundEnabled} onChange={setSoundEnabled} />
                    </div>

                    {/* Snooze Alerts */}
                    <div>
                        <p className="font-semibold">Snooze All Alerts</p>
                        <p className="text-sm text-muted-foreground mb-3">Temporarily pause all incoming notifications.</p>
                        <div className="flex flex-wrap gap-2">
                            {snoozeOptions.map(opt => (
                                <button
                                    key={opt.minutes}
                                    onClick={() => handleSnooze(opt.minutes)}
                                    className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${
                                        snoozeTime === opt.minutes
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-muted text-muted-foreground hover:bg-accent'
                                    }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                        {getSnoozeStatus() && (
                            <div className="mt-3 flex items-center justify-between p-2 rounded-md bg-primary/10">
                                <p className="text-sm text-primary">{getSnoozeStatus()}</p>
                                <button onClick={() => handleSnooze(null)} className="text-sm font-bold text-primary hover:underline">Clear</button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
