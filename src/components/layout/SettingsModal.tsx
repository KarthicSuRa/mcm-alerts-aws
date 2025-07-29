import React, { useState, useEffect } from 'react';
import { Icon } from '../ui/Icon';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    soundEnabled: boolean;
    setSoundEnabled: (enabled: boolean) => void;
    snoozedUntil: Date | null;
    setSnoozedUntil: (date: Date | null) => void;
}

const ToggleSwitch: React.FC<{ enabled: boolean; onChange: (enabled: boolean) => void }> = ({ enabled, onChange }) => (
    <button
        onClick={() => onChange(!enabled)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 ease-in-out ${enabled ? 'bg-primary' : 'bg-muted'}`}
    >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300 ease-in-out ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
);

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, soundEnabled, setSoundEnabled, snoozedUntil, setSnoozedUntil }) => {
    const [permission, setPermission] = useState(window.Notification?.permission);
    const [snoozeTime, setSnoozeTime] = useState<number | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        setPermission(window.Notification?.permission);

        if (snoozedUntil && snoozedUntil > new Date()) {
             const diff = snoozedUntil.getTime() - new Date().getTime();
             // Find which button was conceptually clicked
             if (Math.abs(diff - 30*60*1000) < 1000) setSnoozeTime(30);
             else if (Math.abs(diff - 60*60*1000) < 1000) setSnoozeTime(60);
             else if (Math.abs(diff - 4*60*60*1000) < 1000) setSnoozeTime(240);
             else if (Math.abs(diff - 24*60*60*1000) < 1000) setSnoozeTime(1440);
             else setSnoozeTime(null);
        } else {
            setSnoozedUntil(null);
            setSnoozeTime(null);
        }

    }, [isOpen, snoozedUntil]);

    if (!isOpen) return null;

    const handleRequestNotificationPermission = () => {
        if (!("Notification" in window)) {
            alert("This browser does not support desktop notification");
        } else if (window.Notification.permission !== "denied") {
            window.Notification.requestPermission().then(p => {
                setPermission(p);
                if (p === "granted") {
                    new window.Notification("MCM Alerts", { body: "Push notifications enabled!" });
                }
            });
        }
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

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-card w-full max-w-lg rounded-2xl shadow-xl border border-border" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-6 border-b border-border">
                    <h2 className="text-xl font-bold">Application Settings</h2>
                    <button onClick={onClose} className="p-1.5 rounded-full hover:bg-accent">
                        <Icon name="x" className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-6 space-y-6">
                    {/* Push Notifications */}
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-semibold">Desktop Push Alerts</p>
                            <p className="text-sm text-muted-foreground">Receive alerts on your desktop.</p>
                        </div>
                        {permission === 'granted' ? (
                             <span className="flex items-center gap-2 text-sm font-medium text-success">
                                <Icon name="check" className="w-5 h-5" /> Enabled
                             </span>
                        ) : permission === 'denied' ? (
                             <span className="text-sm font-medium text-destructive">Denied</span>
                        ) : (
                            <button onClick={handleRequestNotificationPermission} className="px-4 py-2 text-sm font-semibold rounded-md bg-foreground text-background hover:bg-foreground/90">
                                Enable
                            </button>
                        )}
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
