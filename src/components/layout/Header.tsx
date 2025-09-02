import * as React from 'react';
import { Icon } from '../ui/Icon';
import { ThemeContext } from '../../contexts/ThemeContext';
import { Session } from '../../types';

interface HeaderProps {
  pageTitle: string;
  onLogout: () => void;
  setIsSidebarOpen: (open: boolean) => void;
  openSettings: () => void;
  session: Session;
}

export const Header: React.FC<HeaderProps> = ({ pageTitle, onLogout, setIsSidebarOpen, openSettings, session }) => {
    const themeContext = React.useContext(ThemeContext);
    const [isProfileOpen, setProfileOpen] = React.useState(false);
    const profileRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
                setProfileOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const userInitial = session.user.email ? session.user.email.charAt(0).toUpperCase() : '?';

    return (
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 sm:px-6 shrink-0">
            <div className="flex items-center gap-4">
                <button
                    className="p-2 -ml-2 rounded-md text-gray-600 lg:hidden"
                    onClick={() => setIsSidebarOpen(true)}
                >
                    <Icon name="menu" className="h-6 w-6" />
                </button>
                <h1 className="text-2xl font-bold text-gray-800">{pageTitle}</h1>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-4">
                <button onClick={themeContext?.toggleTheme} className="p-2 rounded-full text-gray-600 hover:bg-gray-100">
                    <Icon name={themeContext?.theme === 'light' ? 'moon' : 'sun'} className="w-5 h-5"/>
                </button>
                <button onClick={openSettings} className="p-2 rounded-full text-gray-600 hover:bg-gray-100">
                    <Icon name="settings" className="w-5 h-5"/>
                </button>
                
                <div className="relative" ref={profileRef}>
                    <button onClick={() => setProfileOpen(!isProfileOpen)} className="flex items-center justify-center h-9 w-9 rounded-full bg-gray-200 text-gray-600 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary">
                        {userInitial}
                    </button>
                    {isProfileOpen && (
                        <div className="absolute right-0 mt-2 w-56 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                            <div className="py-1 border-b border-gray-200">
                                <div className="px-4 py-3">
                                    <p className="text-xs text-gray-500">Signed in as</p>
                                    <p className="text-sm font-medium text-gray-800 truncate">{session.user.email}</p>
                                </div>
                            </div>
                            <div className="py-1">
                                <a href="#" onClick={(e) => { e.preventDefault(); onLogout(); }} className="flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-gray-100">
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
