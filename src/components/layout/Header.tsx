import * as React from 'react';
import { Icon } from '../ui/Icon';
import { ThemeContext } from '../../contexts/ThemeContext';
import { Session, Notification, SystemStatusData } from '../../types';

interface HeaderProps {
  onLogout: () => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  openSettings: () => void;
  session: Session;
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
}) => {
    const themeContext = React.useContext(ThemeContext);
    const [isProfileOpen, setProfileOpen] = React.useState(false);
    const profileRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
                setProfileOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-card px-4 sm:px-6 shrink-0">
          {/* Left side: Logo, Title, and mobile menu button */}
          <div className="flex items-center gap-4">
            <button
              className="p-2 -ml-2 rounded-md text-muted-foreground lg:hidden"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              aria-label="Toggle sidebar"
            >
              <Icon name="menu" className="h-6 w-6" />
            </button>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Icon name="mcmLogo" className="h-6 w-6 text-primary" />
              </div>
              <h1 className="text-xl font-bold text-foreground">MCM Alerts</h1>
            </div>
          </div>

          {/* Right side: Actions and User Profile */}
          <div className="flex items-center gap-4">
            {/* Search */}
            <div className="relative hidden md:block">
              <Icon name="search" className="w-5 h-5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search alerts..."
                className="w-full pl-10 pr-4 py-2 text-sm rounded-md border border-border bg-transparent shadow-sm focus:border-ring focus:ring-ring"
              />
            </div>

            {/* Theme Toggle */}
            <button
              onClick={themeContext.toggleTheme}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors p-2 rounded-md"
              aria-label="Toggle theme"
            >
              <Icon name={themeContext.theme === 'dark' ? 'sun' : 'moon'} className="w-5 h-5" />
              <span className="hidden sm:inline text-sm font-medium">Theme</span>
            </button>

            {/* Settings */}
            <button
              onClick={openSettings}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors p-2 rounded-md"
              aria-label="Open settings"
            >
              <Icon name="settings" className="w-5 h-5" />
              <span className="hidden sm:inline text-sm font-medium">Settings</span>
            </button>

            {/* Profile Dropdown */}
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setProfileOpen(prev => !prev)}
                className="flex items-center gap-2 p-1 rounded-full focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                  {session.user.email ? session.user.email[0].toUpperCase() : 'U'}
                </div>
                <span className="hidden md:inline text-sm font-medium text-foreground">{session.user.email}</span>
                <Icon name="chevron-down" className="w-4 h-4 text-muted-foreground hidden md:inline" />
              </button>

              {isProfileOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-card border border-border rounded-md shadow-lg py-1 z-10">
                  <button
                    onClick={onLogout}
                    className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-accent flex items-center gap-2"
                  >
                    <Icon name="log-out" className="w-4 h-4" />
                    <span>Logout</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
    );
};
