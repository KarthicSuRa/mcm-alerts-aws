import * as React from 'react';
import { Icon } from '../ui/Icon';
import { ThemeContext } from '../../contexts/ThemeContext';
import { Notification, SystemStatusData, Session } from '../../types';
import { SystemStatusPopover } from './SystemStatusPopover';

interface HeaderProps {
    onNavigate: (page: string) => void;
    onLogout: () => void;
    notifications: Notification[];
    setIsSidebarOpen: (open: boolean) => void;
    openSettings: () => void;
    systemStatus: SystemStatusData;
    session: Session;
    onNotificationIconClick?: () => void; // Add this line
}

export const Header: React.FC<HeaderProps> = ({ 
    onNavigate, 
    onLogout, 
    notifications, 
    setIsSidebarOpen, 
    openSettings, 
    systemStatus, 
    session,
    onNotificationIconClick // Add this parameter
}) => {
    const themeContext = React.useContext(ThemeContext);
    const [isProfileOpen, setProfileOpen] = React.useState(false);
    const [isStatusOpen, setStatusOpen] = React.useState(false);
    const profileRef = React.useRef<HTMLDivElement>(null);
    const statusRef = React.useRef<HTMLDivElement>(null);
    
    const unacknowledgedCount = notifications.filter(n => n.status === 'new').length;

    const isSystemUp = systemStatus.service === 'Ready' && systemStatus.database === 'Connected';
    const statusButtonColor = isSystemUp ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300';
    const statusDotColor = isSystemUp ? 'bg-green-500' : 'bg-red-500';

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
                setProfileOpen(false);
            }
            if (statusRef.current && !statusRef.current.contains(event.target as Node)) {
                setStatusOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-card/80 backdrop-blur-sm px-4 sm:px-6 shrink-0">
            <div className="flex items-center gap-4">
                <button
                    className="p-2 -ml-2 rounded-md text-muted-foreground lg:hidden"
                    onClick={() => setIsSidebarOpen(true)}
                >
                    <Icon name="menu" className="h-6 w-6" />
                </button>
                <div className="flex items-center gap-2">
                   <img src="/icons/icon-192x192.png" alt="MCM Alerts" className="w-8 h-8" />
                   <span className="text-lg font-semibold text-foreground hidden sm:inline">MCM Alerts</span>
                </div>

            </div>
            
            <div className="flex items-center gap-1 sm:gap-2">
                <div className="relative" ref={statusRef}>
                    <button 
                        onClick={() => setStatusOpen(s => !s)} 
                        className={`hidden sm:flex items-center gap-2 text-sm font-semibold px-3 py-1.5 rounded-full transition-colors ${statusButtonColor}`}
                    >
                        <span className={`w-2.5 h-2.5 rounded-full ${statusDotColor} ring-2 ring-offset-2 ring-offset-card dark:ring-offset-dark-card ${statusDotColor}/30`}></span>
                        {isSystemUp ? 'System Up' : 'System Down'}
                    </button>
                    {isStatusOpen && <SystemStatusPopover status={systemStatus} />}
                </div>

                <button onClick={themeContext?.toggleTheme} className="p-2.5 rounded-full text-muted-foreground hover:bg-accent">
                    <Icon name={themeContext?.theme === 'light' ? 'moon' : 'sun'} className="w-5 h-5"/>
                </button>
                <button onClick={openSettings} className="p-2.5 rounded-full text-muted-foreground hover:bg-accent">
                    <Icon name="settings" className="w-5 h-5"/>
                </button>
                <button 
                    onClick={onNotificationIconClick} // Add the click handler here
                    className="relative p-2.5 rounded-full text-muted-foreground hover:bg-accent"
                >
                    <Icon name="bell" className="w-5 h-5"/>
                    {unacknowledgedCount > 0 && (
                        <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold ring-2 ring-card">{unacknowledgedCount}</span>
                    )}
                </button>
                <div className="relative" ref={profileRef}>
                    <button onClick={() => setProfileOpen(!isProfileOpen)} className="p-2 rounded-full text-muted-foreground hover:bg-accent">
                        <Icon name="user" className="w-5 h-5" />
                    </button>
                    {isProfileOpen && (
                        <div className="absolute right-0 mt-2 w-56 origin-top-right rounded-md bg-popover text-popover-foreground shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                            <div className="py-1 border-b border-border">
                                <div className="px-4 py-3">
                                    <p className="text-xs text-muted-foreground">Signed in as</p>
                                    <p className="text-sm font-medium text-foreground truncate">{session.user.email}</p>
                                </div>
                            </div>
                            <div className="py-1">
                                <a href="#" onClick={(e) => { e.preventDefault(); onLogout(); }} className="flex items-center gap-3 px-4 py-2 text-sm text-destructive hover:bg-accent">
                                    <Icon name="logout" className="w-4 h-4" /> Logout
                                </a>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};
