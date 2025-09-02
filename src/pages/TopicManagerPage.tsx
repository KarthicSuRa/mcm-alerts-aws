import React from 'react';
import { Topic, Session } from '../../types';
import { TopicManager } from '../components/dashboard/TopicManager';
import { Icon } from '../components/ui/Icon';

interface TopicManagerPageProps {
  topics: Topic[];
  session: Session | null;
  onAddTopic: (name: string, description: string) => Promise<void>;
  onToggleSubscription: (topicId: string, subscribed: boolean) => Promise<void>;
  onNavigate: (page: string) => void;
}

export const TopicManagerPage: React.FC<TopicManagerPageProps> = ({ 
  topics, 
  session, 
  onAddTopic, 
  onToggleSubscription, 
  onNavigate 
}) => {
  return (
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
        />
      </div>
    </div>
  );
};
