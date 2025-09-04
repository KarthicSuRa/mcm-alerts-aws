import * as React from 'react';
import { Icon } from '../ui/Icon';
import { ThemeContext } from '../../contexts/ThemeContext';
import { Session, Notification, SystemStatusData } from '../../types';
import { SystemStatusPopover } from './SystemStatusPopover';

interface HeaderProps {
  onLogout: () => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  openSettings: () => void;
  session: Session | null;
  notifications: Notification[];
  systemStatus: SystemStatusData;
  onNavigate: (page: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ 
  onLogout, 
  isSidebarOpen, 
  setIsSidebarOpen, 
  openSettings, 
  session,
  systemStatus
}) => {
    const themeContext = React.useContext(ThemeContext);
    const [isProfileOpen, setProfileOpen] = React.useState(false);
    const [isStatusOpen, setStatusOpen] = React.useState(false);
    const profileRef = React.useRef<HTMLDivElement>(null);
    const statusRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
                setProfileOpen(false);
            }
            if (statusRef.current && !statusRef.current.contains(event.target as Node)) {
                setStatusOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    if (!themeContext) {
      return null;
    }
    
    const statusIndicator = {
        operational: { color: 'bg-green-500', text: 'All systems operational' },
        degraded_performance: { color: 'bg-yellow-500', text: 'Degraded performance' },
        major_outage: { color: 'bg-red-500', text: 'Major outage' },
        unknown: { color: 'bg-gray-500', text: 'Status unknown' },
    };

    const currentStatus = systemStatus?.status || 'unknown';
    const statusInfo = statusIndicator[currentStatus];

    return (
        <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-border bg-card px-6 shrink-0">
          {/* Left side: Logo, Title, and mobile menu button */}
          <div className="flex items-center gap-6">
            <button
              className="p-2 -ml-3 rounded-md text-muted-foreground lg:hidden"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              aria-label="Toggle sidebar"
            >
              <Icon name="menu" className="h-7 w-7" />
            </button>
            <div className="hidden items-center gap-4 lg:flex">
               <Icon name="mcmLogo" className="h-9 w-9 text-primary" />
              <h1 className="text-2xl font-bold text-foreground">MCM Alerts</h1>
            </div>
          </div>

          {/* Right side: Actions and User Profile */}
          <div className="flex items-center gap-5">
            {/* Search */}
            <div className="relative hidden md:block">
              <Icon name="search" className="w-6 h-6 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search alerts..."
                className="w-full pl-12 pr-4 py-2.5 text-base rounded-md border border-border bg-transparent shadow-sm focus:border-ring focus:ring-ring"
              />
            </div>

            {/* System Status Popover */}
            <div className="relative hidden lg:flex" ref={statusRef}>
                 <button
                    onClick={() => setStatusOpen(prev => !prev)}
                    className="flex items-center gap-3 text-muted-foreground hover:text-foreground transition-colors p-3 rounded-md"
                    aria-label="System Status"
                  >
                    <div className={`w-3 h-3 rounded-full transition-colors ${statusInfo.color}`}></div>
                    <span className="text-sm font-medium">
                        System Status
                    </span>
                </button>
                {isStatusOpen && <SystemStatusPopover status={systemStatus} />}
            </div>

            {/* Theme Toggle */}
            <button
              onClick={themeContext.toggleTheme}
              className="flex items-center gap-3 text-muted-foreground hover:text-foreground transition-colors p-3 rounded-md"
              aria-label="Toggle theme"
            >
              <Icon name={themeContext.theme === 'dark' ? 'sun' : 'moon'} className="w-6 h-6" />
              <span className="hidden sm:inline text-base font-medium">Theme</span>
            </button>

            {/* Settings */}
            <button
              onClick={openSettings}
              className="flex items-center gap-3 text-muted-foreground hover:text-foreground transition-colors p-3 rounded-md"
              aria-label="Open settings"
            >
              <Icon name="settings" className="w-6 h-6" />
              <span className="hidden sm:inline text-base font-medium">Settings</span>
            </button>

            {/* Profile Dropdown */}
            {session && (
              <div className="relative" ref={profileRef}>
                <button
                  onClick={() => setProfileOpen(prev => !prev)}
                  className="flex items-center gap-3 p-1.5 rounded-full focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary text-lg font-bold">
                    {session.user.email ? session.user.email[0].toUpperCase() : 'U'}
                  </div>
                  <span className="hidden md:inline text-base font-medium text-foreground">{session.user.email}</span>
                  <Icon name="chevron-down" className="w-5 h-5 text-muted-foreground hidden md:inline" />
                </button>

                {isProfileOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-card border border-border rounded-md shadow-lg py-2 z-10">
                    <button
                      onClick={onLogout}
                      className="w-full text-left px-4 py-3 text-base text-foreground hover:bg-accent flex items-center gap-3"
                    >
                      <Icon name="log-out" className="w-5 h-5" />
                      <span>Logout</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </header>
    );
};
