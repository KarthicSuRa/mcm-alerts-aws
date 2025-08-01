import React, { useState } from 'react';
import { Topic, Session } from '../../types';
import { Icon } from '../ui/Icon';

interface TopicManagerProps {
    topics: Topic[];
    session: Session | null;
    onAddTopic: (name: string, description: string) => Promise<void>;
    onToggleSubscription: (topic: Topic) => Promise<void>;
}

export const TopicManager: React.FC<TopicManagerProps> = ({ topics, session, onAddTopic, onToggleSubscription }) => {
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

    return (
        <div className="bg-card h-full">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold">Subscriptions</h3>
                {!isAdding && (
                     <button 
                        onClick={() => setIsAdding(true)}
                        className="flex items-center gap-1.5 text-sm font-medium text-primary hover:opacity-80"
                    >
                        <Icon name="plus" className="w-4 h-4" />
                        Add Topic
                    </button>
                )}
            </div>

            {isAdding && (
                <div className="space-y-4 p-4 bg-secondary rounded-lg border border-border">
                    <h4 className="font-semibold text-foreground">Create New Topic</h4>
                    <input
                        type="text"
                        value={newTopicName}
                        onChange={e => setNewTopicName(e.target.value)}
                        placeholder="New topic name*"
                        className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md focus:ring-ring focus:border-ring"
                        autoFocus
                    />
                    <textarea
                        value={newTopicDesc}
                        onChange={e => setNewTopicDesc(e.target.value)}
                        placeholder="Optional description..."
                        rows={2}
                        className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md focus:ring-ring focus:border-ring resize-none"
                    />
                     <div className="flex gap-2 justify-end pt-2">
                        <button onClick={handleCancel} className="px-4 py-2 rounded-md bg-muted text-muted-foreground text-sm font-semibold hover:bg-accent">
                            Cancel
                        </button>
                        <button onClick={handleAddTopic} className="px-4 py-2 rounded-md bg-foreground text-background text-sm font-semibold hover:opacity-80 disabled:opacity-50" disabled={!newTopicName.trim()}>Save</button>
                     </div>
                </div>
            )}

            {topics.length === 0 && !isAdding ? (
                <div className="text-center py-12 text-muted-foreground">
                    <p className="text-sm">No topics configured.</p>
                    <p className="text-xs mt-1">Click 'Add Topic' to start.</p>
                </div>
            ) : (
                <div className="space-y-3 pt-2">
                    {topics.map(topic => (
                        <div key={topic.id} className="p-4 rounded-lg border border-border bg-secondary/50">
                            <div className="flex items-center justify-between">
                                <div className="pr-4">
                                    <p className="font-semibold text-foreground">{topic.name}</p>
                                    <p className="text-sm text-muted-foreground">{topic.description}</p>
                                </div>
                                <button onClick={() => onToggleSubscription(topic)} className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors ${topic.subscribed ? 'bg-primary' : 'bg-muted'}`}>
                                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${topic.subscribed ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
