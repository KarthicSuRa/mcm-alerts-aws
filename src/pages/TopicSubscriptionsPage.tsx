import React from 'react';
import { Header } from '../components/layout/Header';
import { Topic, Notification, SystemStatusData, Session } from '../types';
import { Icon } from '../components/ui/Icon';

interface TopicSubscriptionsPageProps {
  topics: Topic[];
  onToggleSubscription: (topicId: string) => void;
  onNavigate: (page: string) => void;
  onLogout: () => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  openSettings: () => void;
  systemStatus: SystemStatusData;
  notifications: Notification[];
  session: Session;
}

export const TopicSubscriptionsPage: React.FC<TopicSubscriptionsPageProps> = ({ 
  topics, 
  onToggleSubscription, 
  onNavigate, 
  onLogout, 
  isSidebarOpen, 
  setIsSidebarOpen, 
  openSettings, 
  systemStatus, 
  notifications, 
  session 
}) => {
  return (
    <>
      <Header onNavigate={onNavigate} onLogout={onLogout} notifications={notifications} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} openSettings={openSettings} systemStatus={systemStatus} session={session} />
      <main className={`flex-1 overflow-y-auto bg-background transition-all duration-300 ${isSidebarOpen ? 'lg:ml-72' : ''}`}>
        <div className="p-4 md:p-6 lg:p-8 text-foreground">
          <div className="flex items-center mb-6">
            <button onClick={() => onNavigate('dashboard')} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 mr-4 lg:hidden">
                <Icon name="arrow-left" className="h-6 w-6" />
            </button>
            <h1 className="text-3xl font-bold">Topic Subscriptions</h1>
          </div>

          <div className="bg-card rounded-xl border border-border shadow-sm p-6">
            <h2 className="text-2xl font-semibold mb-4">All Topics</h2>
            <div className="divide-y divide-border">
              {topics.map(topic => (
                <div key={topic.id} className="py-4 flex items-center justify-between">
                  <div>
                    <p className="text-lg font-medium text-foreground">{topic.name}</p>
                    <p className="text-sm text-muted-foreground">{topic.description}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                        type="checkbox" 
                        checked={topic.status === 'active'}
                        onChange={() => onToggleSubscription(topic.id)} 
                        className="sr-only peer" 
                    />
                    <div className="w-11 h-6 bg-secondary peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-ring/50 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </>
  );
};
