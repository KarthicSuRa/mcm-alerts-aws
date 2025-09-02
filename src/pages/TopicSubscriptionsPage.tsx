import React from 'react';
import { Topic } from '../types';
import { Icon } from '../components/ui/Icon';

interface TopicSubscriptionsPageProps {
  topics: Topic[];
  onToggleSubscription: (topicId: string) => void;
  onNavigate: (page: string) => void;
}

export const TopicSubscriptionsPage: React.FC<TopicSubscriptionsPageProps> = ({ topics, onToggleSubscription, onNavigate }) => {
  return (
    <div className="p-4 md:p-6 lg:p-8 text-foreground bg-background">
      <div className="flex items-center mb-6">
        <button onClick={() => onNavigate('dashboard')} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 mr-4">
            <Icon name="arrowLeft" className="h-6 w-6" />
        </button>
        <h1 className="text-3xl font-bold">Topic Subscriptions</h1>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-semibold mb-4">All Topics</h2>
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {topics.map(topic => (
            <div key={topic.id} className="py-4 flex items-center justify-between">
              <div>
                <p className="text-lg font-medium text-gray-900 dark:text-white">{topic.name}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{topic.description}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                    type="checkbox" 
                    checked={topic.status === 'active'}
                    onChange={() => onToggleSubscription(topic.id)} 
                    className="sr-only peer" 
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
              </label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
