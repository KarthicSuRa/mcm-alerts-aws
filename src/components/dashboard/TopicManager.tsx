import React, { useState, useMemo } from 'react';
import { Topic, Session, User, Team } from '../../types';
import { Icon } from '../ui/Icon';
import { awsClient } from '../../lib/awsClient';

interface TopicManagerProps {
    topics: Topic[];
    teams: Team[];
    session: Session | null;
    onAddTopic: (name: string, description: string, teamId: string | null) => Promise<void>;
    onToggleSubscription: (topic: Topic) => Promise<void>;
    onDeleteTopic: (topic: Topic) => Promise<void>;
}

const topicIcons: { [key: string]: string } = {
    default: 'file-text',
    order: 'shopping-cart',
    payment: 'credit-card',
    postman: 'send',
    security: 'shield',
    server: 'server-2',
    site: 'monitor',
    system: 'settings',
};

const getIconForTopic = (topicName: string) => {
    const lowerCaseName = topicName.toLowerCase();
    for (const key in topicIcons) {
        if (lowerCaseName.includes(key)) {
            return topicIcons[key];
        }
    }
    return topicIcons.default;
};

export const TopicManager: React.FC<TopicManagerProps> = ({ topics, teams, session, onAddTopic, onToggleSubscription, onDeleteTopic }) => {
    const [isAdding, setIsAdding] = useState(false);
    const [newTopicName, setNewTopicName] = useState('');
    const [newTopicDesc, setNewTopicDesc] = useState('');
    const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
    const [subscriberModalTopic, setSubscriberModalTopic] = useState<Topic | null>(null);
    const [subscribers, setSubscribers] = useState<User[]>([]);
    const [loadingSubscribers, setLoadingSubscribers] = useState(false);

    const handleAddTopic = async () => {
        if (newTopicName.trim()) {
            await onAddTopic(newTopicName, newTopicDesc, selectedTeam);
            setNewTopicName('');
            setNewTopicDesc('');
            setSelectedTeam(null);
            setIsAdding(false);
        }
    };
    
    const handleCancel = () => {
        setIsAdding(false);
        setNewTopicName('');
        setNewTopicDesc('');
        setSelectedTeam(null);
    }

    const handleDeleteConfirmation = (topic: Topic) => {
        if (window.confirm(`Are you sure you want to delete the topic \"${topic.name}\"?`)) {
            onDeleteTopic(topic);
        }
    };

    const handleViewSubscribers = async (topic: Topic) => {
        setSubscriberModalTopic(topic);
        setLoadingSubscribers(true);
        setSubscribers([]);

        try {
            const data = await awsClient.get(`/topics/${topic.id}/subscribers`);
            setSubscribers(data || []);
        } catch (error) {
            console.error('Error fetching subscribers:', error);
            setSubscribers([]);
        } finally {
            setLoadingSubscribers(false);
        }
    };

    const memoizedTopics = useMemo(() => topics.map(topic => (
        <TopicCard 
            key={topic.id} 
            topic={topic} 
            onToggleSubscription={onToggleSubscription} 
            onDeleteTopic={handleDeleteConfirmation} 
            onViewSubscribers={handleViewSubscribers} 
        />
    )), [topics, onToggleSubscription, handleDeleteConfirmation, handleViewSubscribers]);

    return (
        <>
            <div className="pt-2">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-semibold text-gray-800 dark:text-white">All Topics</h3>
                    <button 
                        onClick={() => setIsAdding(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg shadow-sm hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                        <Icon name="plus" className="w-5 h-5" />
                        <span className="hidden sm:inline">Add New Topic</span>
                    </button>
                </div>

                {topics.length === 0 && !isAdding ? (
                    <div className="text-center py-20 text-gray-500 dark:text-gray-400 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl mt-8">
                        <Icon name="bell-off" className="w-16 h-16 mx-auto text-gray-400" />
                        <p className="mt-5 text-xl font-semibold">No topics yet.</p>
                        <p className="text-md mt-2">Get started by adding a new topic to manage subscriptions.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">
                        {memoizedTopics}
                    </div>
                )}
            </div>

            {isAdding && 
                <AddTopicModal 
                    onClose={handleCancel} 
                    onAddTopic={handleAddTopic} 
                    newTopicName={newTopicName} 
                    setNewTopicName={setNewTopicName} 
                    newTopicDesc={newTopicDesc} 
                    setNewTopicDesc={setNewTopicDesc} 
                    teams={teams} 
                    selectedTeam={selectedTeam} 
                    setSelectedTeam={setSelectedTeam} 
                />
            }

            {subscriberModalTopic && (
                 <SubscriberModal 
                    topic={subscriberModalTopic} 
                    subscribers={subscribers} 
                    loading={loadingSubscribers} 
                    onClose={() => setSubscriberModalTopic(null)} 
                />
            )}
        </>
    );
};

const TopicCard = ({ topic, onToggleSubscription, onDeleteTopic, onViewSubscribers }: { topic: Topic, onToggleSubscription: (t: Topic) => void, onDeleteTopic: (t: Topic) => void, onViewSubscribers: (t: Topic) => void }) => {
    const iconName = getIconForTopic(topic.name);
    const [isToggling, setIsToggling] = useState(false);

    const handleToggle = async () => {
        setIsToggling(true);
        await onToggleSubscription(topic);
        setIsToggling(false);
    }

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md hover:shadow-lg transition-shadow duration-300 overflow-hidden flex flex-col border border-gray-200 dark:border-gray-700">
            <div className="p-5 flex-grow">
                <div className="flex items-start">
                    <div className="bg-gray-100 dark:bg-gray-700/50 p-3 rounded-lg mr-4">
                        <Icon name={iconName} className="w-6 h-6 text-gray-700 dark:text-gray-300" />
                    </div>
                    <div className="flex-1">
                        <h4 className="text-md font-semibold text-gray-900 dark:text-white truncate pr-2">{topic.name}</h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 h-12 leading-snug">{topic.description}</p>
                    </div>
                </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800/50 px-5 py-3 border-t border-gray-100 dark:border-gray-700/50">
                <div className="flex justify-between items-center">
                    <button onClick={() => onViewSubscribers(topic)} className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                        <Icon name="users" className="w-4 h-4" />
                        <span className="font-medium">Subscribers</span>
                    </button>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={handleToggle}
                            disabled={isToggling}
                            className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors duration-200 ease-in-out ${topic.subscribed ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'} ${isToggling ? 'opacity-50 cursor-not-allowed' : ''}`}>
                            <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform duration-200 ease-in-out ${topic.subscribed ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                        <button 
                            onClick={() => onDeleteTopic(topic)}
                            className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded-full"
                            title="Delete Topic"
                        >
                            <Icon name="trash-2" className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

const AddTopicModal = ({ onClose, onAddTopic, newTopicName, setNewTopicName, newTopicDesc, setNewTopicDesc, teams, selectedTeam, setSelectedTeam }: any) => (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4" onClick={onClose}>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Create a New Topic</h3>
            </div>
            <div className="p-6 space-y-5">
                <input
                    type="text"
                    value={newTopicName}
                    onChange={e => setNewTopicName(e.target.value)}
                    placeholder="Topic Name (e.g., 'API Downtime')"
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                    autoFocus
                />
                <textarea
                    value={newTopicDesc}
                    onChange={e => setNewTopicDesc(e.target.value)}
                    placeholder="A brief description for the topic..."
                    rows={4}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition resize-none"
                />
                <select
                    value={selectedTeam || ''}
                    onChange={e => setSelectedTeam(e.target.value || null)}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                >
                    <option value="">Assign to a team (optional)</option>
                    {teams.map((team: Team) => (
                        <option key={team.id} value={team.id}>{team.name}</option>
                    ))}
                </select>
            </div>
            <div className="p-6 bg-gray-50 dark:bg-gray-800/50 rounded-b-xl flex justify-end gap-4">
                <button onClick={onClose} className="px-5 py-2.5 rounded-lg bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white font-semibold hover:bg-gray-300 dark:hover:bg-gray-500 transition">
                    Cancel
                </button>
                <button onClick={onAddTopic} className="px-5 py-2.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-60 transition" disabled={!newTopicName.trim()}>
                    Save Topic
                </button>
            </div>
        </div>
    </div>
);

const SubscriberModal = ({ topic, subscribers, loading, onClose }: { topic: Topic, subscribers: User[], loading: boolean, onClose: () => void }) => (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4" onClick={onClose}>
        <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white p-6 rounded-xl shadow-2xl max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center pb-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-xl font-bold flex items-center gap-3">
                    <Icon name="users" className="w-6 h-6 text-blue-500" />
                    Subscribers for {topic.name}
                </h3>
                <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
                    <Icon name="close" className="h-6 w-6 text-gray-500 dark:text-gray-400" />
                </button>
            </div>
            
            <div className="py-4">
                {loading ? (
                    <div className="space-y-3 pt-2">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="flex items-center gap-3 animate-pulse">
                                <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700"></div>
                                <div className="flex-1 space-y-2">
                                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : subscribers.length > 0 ? (
                    <div className="space-y-3 max-h-60 overflow-y-auto pr-2 -mr-4 custom-scrollbar">
                        {subscribers.map(user => {
                            const userInitial = (user.full_name || user.email || 'U')[0].toUpperCase();
                            return (
                                <div key={user.id} className="flex items-center gap-4 py-2">
                                    <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 flex items-center justify-center font-bold text-lg flex-shrink-0">
                                        {user.avatar_url ? <img src={user.avatar_url} alt={user.full_name ?? 'User Avatar'} className="rounded-full w-full h-full object-cover" /> : userInitial}
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-semibold text-md text-gray-900 dark:text-white">{user.full_name || 'Unknown User'}</p>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-center py-10">
                        <Icon name="user-x" className="w-12 h-12 mx-auto text-gray-400" />
                        <p className="mt-4 font-semibold text-gray-600 dark:text-gray-300">No subscribers found for this topic.</p>
                    </div>
                )}
            </div>

            <div className="mt-2 flex justify-end">
                <button 
                    className="px-5 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white font-semibold rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                    onClick={onClose}
                >
                    Close
                </button>
            </div>
        </div>
    </div>
);
