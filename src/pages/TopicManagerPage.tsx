import React from 'react';
import { Header } from '../components/layout/Header';
import { Topic, Session, SystemStatusData, Notification, Database } from '../types';
import { TopicManager } from '../components/dashboard/TopicManager';
import { Icon } from '../components/ui/Icon';

// Define the Team type based on your database schema
type Team = Database['public']['Tables']['teams']['Row'];

interface TopicManagerPageProps {
  topics: Topic[];
  teams: Team[]; // Add teams to props
  session: Session | null;
  onAddTopic: (name: string, description: string, team_id: string | null) => Promise<void>; // Update signature
  onToggleSubscription: (topic: Topic) => Promise<void>;
  onDeleteTopic: (topic: Topic) => Promise<void>;
  onNavigate: (page: string) => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  onLogout: () => Promise<void>;
  openSettings: () => void;
  systemStatus: SystemStatusData;
  notifications: Notification[];
}

export const TopicManagerPage: React.FC<TopicManagerPageProps> = ({ 
  topics, 
  teams, // Destructure teams
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
      <Header onNavigate={onNavigate} onLogout={onLogout} notifications={notifications} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} openSettings={openSettings} systemStatus={systemStatus} session={session} title="Topic Manager" />
      <main className="flex-1 overflow-y-auto bg-background md:ml-72">
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
              teams={teams} // Pass teams down
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
