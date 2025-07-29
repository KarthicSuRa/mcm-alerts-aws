import React, { useRef, useEffect, useState } from 'react';
import { Icon } from '../ui/Icon';
import { Topic, Session } from '../../types';
import { TopicManager } from '../dashboard/TopicManager';

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (isOpen: boolean) => void;
  sendTestAlert: () => void;
  topics: Topic[];
  session: Session | null;
  onAddTopic: (name: string, description: string) => Promise<void>;
  onToggleSubscription: (topic: Topic) => Promise<void>;
}

const navItems = [
  { name: 'Dashboard', icon: 'dashboard', page: 'dashboard' },
  { name: 'Subscriptions', icon: 'layers', page: 'subscriptions' },
  { name: 'How It Works', icon: 'info', page: 'how-it-works' },
  { name: 'API Docs', icon: 'docs', page: 'api-docs' },
  { name: 'Audit Logs', icon: 'logs', page: 'audit-logs' },
];

export const Sidebar: React.FC<SidebarProps> = ({ 
    currentPage, 
    onNavigate, 
    isSidebarOpen, 
    setIsSidebarOpen, 
    sendTestAlert, 
    topics, 
    session,
    onAddTopic,
    onToggleSubscription
}) => {
    const sidebarRef = useRef<HTMLElement>(null);
    const [view, setView] = useState<'nav' | 'topics'>('nav');

    useEffect(() => {
        if (!isSidebarOpen) {
            // Reset view when sidebar closes
            setTimeout(() => setView('nav'), 300);
        }
    }, [isSidebarOpen]);

    const handleNavClick = (page: string) => {
        if (page === 'subscriptions') {
            setView('topics');
        } else {
            onNavigate(page);
        }
    }

    const MainNavView = () => (
      <>
        <div className="h-16 flex items-center justify-between px-6 border-b border-border shrink-0">
            <button onClick={() => onNavigate('dashboard')} className="flex items-center gap-2">
                <Icon name="mcmLogo" />
            </button>
            <button onClick={() => setIsSidebarOpen(false)} className="p-2 -mr-2 rounded-md text-muted-foreground lg:hidden">
                <Icon name="x" className="h-5 w-5" />
            </button>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {navItems.map(item => (
            <a
              key={item.name}
              href="#"
              onClick={(e) => { e.preventDefault(); handleNavClick(item.page); }}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-all ${
                currentPage === item.page && view === 'nav'
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              <Icon name={item.icon} className="h-5 w-5" />
              {item.name}
            </a>
          ))}
        </nav>
        <div className="p-4 mt-auto border-t border-border">
            <button
                onClick={sendTestAlert}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 bg-foreground text-background hover:bg-foreground/90 focus:ring-ring dark:focus:ring-offset-card"
            >
                <Icon name="send" className="w-4 h-4" />
                Send Test Alert
            </button>
        </div>
      </>
    );

    const TopicsView = () => (
        <>
          <div className="h-16 flex items-center px-4 border-b border-border shrink-0">
            <button onClick={() => setView('nav')} className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
                <Icon name="arrowLeft" className="w-4 h-4"/>
                Back to Menu
            </button>
          </div>
          <div className="flex-1 p-4 overflow-y-auto">
             <TopicManager 
                topics={topics} 
                session={session} 
                onAddTopic={onAddTopic}
                onToggleSubscription={onToggleSubscription}
             />
          </div>
        </>
    );

  return (
    <>
        {isSidebarOpen && <div className="fixed inset-0 bg-black/60 z-30 lg:hidden" onClick={() => setIsSidebarOpen(false)}></div>}
        <aside 
            ref={sidebarRef}
            className={`fixed top-0 left-0 z-40 h-screen w-72 bg-card border-r border-border flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
        >
          {view === 'nav' ? <MainNavView /> : <TopicsView />}
        </aside>
    </>
  );
};
