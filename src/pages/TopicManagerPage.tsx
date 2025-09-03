import React from 'react';
import { Header } from '../components/layout/Header';
import { Topic, Session, SystemStatusData, Notification } from '../types';
import { TopicManager } from '../components/dashboard/TopicManager';
import { Icon } from '../components/ui/Icon';

interface TopicManagerPageProps {
  topics: Topic[];
  session: Session | null;
  onAddTopic: (name: string, description: string) => Promise<void>;
  onToggleSubscription: (topic: Topic) => Promise<void>;
  onDeleteTopic: (topic: Topic) => Promise<void>;
  onNavigate: (page: string) => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  onLogout: () => void;
  openSettings: () => void;
  systemStatus: SystemStatusData;
  notifications: Notification[];
}

export const TopicManagerPage: React.FC<TopicManagerPageProps> = ({ 
  topics, 
  session, 
  onAddTopic, 
  onToggleSubscription, 
  onDeleteTopic,
  onNavigate, 
  isSidebarOpen, 
  setIsSidebarOpen,
  onLogout,
  openSettings,
  systemStatus,
  notifications,
}) => {
  return (
    <>
    <Header onNavigate={onNavigate} onLogout={onLogout} notifications={notifications} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} openSettings={openSettings} systemStatus={systemStatus} session={session} />
    <main className="flex-1 overflow-y-auto bg-background lg:ml-72">
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="flex items-center mb-6">
          <button onClick={() => onNavigate('dashboard')} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 mr-4">
            <Icon name="arrow-left" className="h-5 w-5 text-gray-700 dark:text-gray-300" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Manage Topic Subscriptions</h1>
        </div>
        <div className="max-w-4xl mx-auto">
          <TopicManager 
            topics={topics} 
            session={session} 
            onAddTopic={onAddTopic} 
            onToggleSubscription={onToggleSubscription} 
            onDeleteTopic={onDeleteTopic} 
          />
        </div>
      </div>
    </main>
    </>
  );
};
