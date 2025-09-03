import React from 'react';
import { Icon } from '../ui/Icon';

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (isOpen: boolean) => void;
  onSendTestAlert: () => void;
}

const navItems = [
  { name: 'Dashboard', icon: 'dashboard', page: 'dashboard' },
  { name: 'Calendar', icon: 'calendar-view', page: 'calendar' },
  { name: 'Site Monitoring', icon: 'monitor', page: 'site-monitoring' },
  { name: 'Topic Subscriptions', icon: 'topic', page: 'topic-manager' },
  { name: 'API Docs', icon: 'docs', page: 'api-docs' },
  { name: 'Audit Logs', icon: 'logs', page: 'audit-logs' },
  { name: 'How It Works', icon: 'info', page: 'how-it-works' },
];

export const Sidebar: React.FC<SidebarProps> = ({ 
    currentPage, 
    onNavigate, 
    isSidebarOpen, 
    setIsSidebarOpen,
    onSendTestAlert
}) => {
    return (
        <>
            {isSidebarOpen && <div className="fixed inset-0 bg-black/60 z-30 lg:hidden" onClick={() => setIsSidebarOpen(false)}></div>}
            <aside 
                className={`fixed top-0 left-0 z-40 h-screen w-72 bg-slate-900 text-slate-300 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
            >
                <div className="h-16 flex items-center justify-center px-4 border-b border-slate-700 shrink-0">
                    <button onClick={() => onNavigate('dashboard')} className="flex items-center gap-2 text-white">
                         <Icon name="mcmLogo" className="h-8 w-8" />
                        <span className="text-xl font-semibold">MCM Alerts</span>
                    </button>
                </div>

                <nav className="flex-1 px-4 py-4 space-y-1">
                    {navItems.map(item => (
                        <a
                            key={item.name}
                            href="#"
                            onClick={(e) => { e.preventDefault(); onNavigate(item.page); }}
                            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all ${
                                currentPage === item.page
                                    ? 'bg-slate-800 text-white'
                                    : 'hover:bg-slate-700/50 hover:text-white'
                            }`}
                        >
                            <Icon name={item.icon} className="h-5 w-5" />
                            {item.name}
                        </a>
                    ))}
                </nav>

                <div className="px-4 py-4 mt-auto border-t border-slate-700">
                    <button 
                        onClick={onSendTestAlert}
                        className="w-full bg-blue-600 text-white font-semibold py-2 rounded-md hover:bg-blue-700 transition-all flex items-center justify-center gap-2 text-sm"
                    >
                        <Icon name="bell" className="h-4 w-4" />
                        Send Test Alert
                    </button>
                </div>
            </aside>
        </>
    );
};