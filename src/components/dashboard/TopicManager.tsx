import React, { useState } from 'react';
import { Topic, Session } from '../../types';
import { Icon } from '../ui/Icon';

interface TopicManagerProps {
    topics: Topic[];
    session: Session | null;
    onAddTopic: (name: string, description: string) => Promise<void>;
    onToggleSubscription: (topic: Topic) => Promise<void>;
    onDeleteTopic: (topic: Topic) => Promise<void>;
}

export const TopicManager: React.FC<TopicManagerProps> = ({ topics, session, onAddTopic, onToggleSubscription, onDeleteTopic }) => {
    const [isAdding, setIsAdding] = useState(false);
    const [newTopicName, setNewTopicName] = useState('');
    const [newTopicDesc, setNewTopicDesc] = useState('');

    const handleAddTopic = async () => {
        if (newTopicName.trim()) {
            await onAddTopic(newTopicName, newTopicDesc);
            setNewTopicName('');
            setNewTopicDesc('');
            setIsAdding(false);
        }
    };
    
    const handleCancel = () => {
        setIsAdding(false);
        setNewTopicName('');
        setNewTopicDesc('');
    }

    const handleDeleteConfirmation = (topic: Topic) => {
        if (window.confirm(`Are you sure you want to delete the topic "${topic.name}"?`)) {
            onDeleteTopic(topic);
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 h-full">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Topic Subscriptions</h3>
                {!isAdding && (
                     <button 
                        onClick={() => setIsAdding(true)}
                        className="flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                    >
                        <Icon name="plus-circle" className="w-5 h-5" />
                        Add New Topic
                    </button>
                )}
            </div>

            {isAdding && (
                <div className="space-y-4 p-4 mb-6 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-700">
                    <h4 className="text-lg font-semibold text-gray-800 dark:text-white">Create a New Topic</h4>
                    <input
                        type="text"
                        value={newTopicName}
                        onChange={e => setNewTopicName(e.target.value)}
                        placeholder="Enter topic name (e.g., 'API Downtime')"
                        className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                        autoFocus
                    />
                    <textarea
                        value={newTopicDesc}
                        onChange={e => setNewTopicDesc(e.target.value)}
                        placeholder="Provide a brief description for this topic"
                        rows={3}
                        className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition resize-none"
                    />
                     <div className="flex gap-3 justify-end pt-2">
                        <button onClick={handleCancel} className="px-4 py-2 rounded-md bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white text-sm font-semibold hover:bg-gray-300 dark:hover:bg-gray-500 transition">
                            Cancel
                        </button>
                        <button onClick={handleAddTopic} className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 transition" disabled={!newTopicName.trim()}>
                            Save Topic
                        </button>
                     </div>
                </div>
            )}

            {topics.length === 0 && !isAdding ? (
                <div className="text-center py-16 text-gray-500 dark:text-gray-400 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
                     <Icon name="bell-off" className="w-12 h-12 mx-auto text-gray-400" />
                    <p className="mt-4 text-lg font-semibold">No topics found.</p>
                    <p className="text-sm mt-1">Click 'Add New Topic' to create your first subscription topic.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {topics.map(topic => (
                        <div key={topic.id} className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-between transition-shadow hover:shadow-md">
                            <div className="pr-4">
                                <p className="font-semibold text-lg text-gray-800 dark:text-white">{topic.name}</p>
                                <p className="text-sm text-gray-600 dark:text-gray-400">{topic.description}</p>
                            </div>
                            <div className="flex items-center gap-4">
                                 <button 
                                    onClick={() => onToggleSubscription(topic)}
                                    className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors duration-200 ease-in-out ${topic.subscribed ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
                                    <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform duration-200 ease-in-out ${topic.subscribed ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                                <button 
                                    onClick={() => handleDeleteConfirmation(topic)}
                                    className="text-gray-400 hover:text-red-500 transition-colors"
                                >
                                    <Icon name="trash" className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};