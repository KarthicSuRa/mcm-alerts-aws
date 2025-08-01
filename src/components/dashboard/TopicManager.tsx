import React, { useState, useRef, useEffect } from 'react';
import { Topic, Session } from '../../types';
import { Icon } from '../ui/Icon';

interface TopicManagerProps {
    topics: Topic[];
    session: Session | null;
    onAddTopic: (name: string, description: string) => Promise<void>;
    onToggleSubscription: (topic: Topic) => Promise<void>;
}

export const TopicManager: React.FC<TopicManagerProps> = ({ 
    topics, 
    session, 
    onAddTopic, 
    onToggleSubscription 
}) => {
    const [isAdding, setIsAdding] = useState(false);
    const [newTopicName, setNewTopicName] = useState('');
    const [newTopicDesc, setNewTopicDesc] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    // Refs to prevent auto-close issues
    const containerRef = useRef<HTMLDivElement>(null);
    const nameInputRef = useRef<HTMLInputElement>(null);
    const descInputRef = useRef<HTMLTextAreaElement>(null);

    // Focus management to prevent auto-close
    useEffect(() => {
        if (isAdding && nameInputRef.current) {
            // Small delay to ensure proper focus
            const timer = setTimeout(() => {
                nameInputRef.current?.focus();
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [isAdding]);

    const handleAddTopic = async () => {
        if (!newTopicName.trim() || isLoading) return;
        
        setIsLoading(true);
        setError(null);
        
        try {
            await onAddTopic(newTopicName.trim(), newTopicDesc.trim());
            
            // Success - reset form
            setNewTopicName('');
            setNewTopicDesc('');
            setIsAdding(false);
            
        } catch (error) {
            console.error('Error adding topic:', error);
            setError(error instanceof Error ? error.message : 'Failed to add topic. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleCancel = () => {
        if (isLoading) return; // Prevent canceling during loading
        
        setIsAdding(false);
        setNewTopicName('');
        setNewTopicDesc('');
        setError(null);
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        // Prevent event bubbling to parent components
        e.stopPropagation();
        
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleAddTopic();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            handleCancel();
        }
    };

    const handleToggleSubscription = async (topic: Topic) => {
        if (isLoading) return;
        
        try {
            await onToggleSubscription(topic);
        } catch (error) {
            console.error('Error toggling subscription:', error);
            alert(error instanceof Error ? error.message : 'Failed to update subscription. Please try again.');
        }
    };

    // Prevent clicks from bubbling up and causing auto-close
    const handleContainerClick = (e: React.MouseEvent) => {
        e.stopPropagation();
    };

    const handleInputFocus = (e: React.FocusEvent) => {
        e.stopPropagation();
    };

    const handleInputBlur = (e: React.FocusEvent) => {
        e.stopPropagation();
        // Don't close the form on blur - only close via Cancel button or successful submission
    };

    const handleAddTopicClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsAdding(true);
    };

    const handleButtonClick = (e: React.MouseEvent, action: () => void) => {
        e.preventDefault();
        e.stopPropagation();
        action();
    };

    return (
        <div className="bg-card h-full" ref={containerRef} onClick={handleContainerClick}>
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold">Subscriptions</h3>
                {!isAdding && (
                    <button 
                        onClick={handleAddTopicClick}
                        className="flex items-center gap-1.5 text-sm font-medium text-primary hover:opacity-80 transition-opacity disabled:opacity-50"
                        disabled={isLoading}
                        type="button"
                    >
                        <Icon name="plus" className="w-4 h-4" />
                        Add Topic
                    </button>
                )}
            </div>

            {isAdding && (
                <div 
                    className="space-y-4 p-4 bg-secondary rounded-lg border border-border mb-6"
                    onClick={handleContainerClick}
                >
                    <h4 className="font-semibold text-foreground">Create New Topic</h4>
                    
                    {error && (
                        <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20">
                            <p className="text-sm text-destructive">{error}</p>
                        </div>
                    )}
                    
                    <div className="space-y-3">
                        <input
                            ref={nameInputRef}
                            type="text"
                            value={newTopicName}
                            onChange={e => setNewTopicName(e.target.value)}
                            onKeyDown={handleKeyPress}
                            onFocus={handleInputFocus}
                            onBlur={handleInputBlur}
                            onClick={handleContainerClick}
                            placeholder="New topic name*"
                            className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md focus:ring-ring focus:border-ring focus:outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={isLoading}
                            maxLength={100}
                            required
                            autoComplete="off"
                        />
                        
                        <textarea
                            ref={descInputRef}
                            value={newTopicDesc}
                            onChange={e => setNewTopicDesc(e.target.value)}
                            onKeyDown={handleKeyPress}
                            onFocus={handleInputFocus}
                            onBlur={handleInputBlur}
                            onClick={handleContainerClick}
                            placeholder="Optional description..."
                            rows={2}
                            className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md focus:ring-ring focus:border-ring focus:outline-none resize-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={isLoading}
                            maxLength={500}
                            autoComplete="off"
                        />
                        
                        <div className="flex gap-2 justify-end pt-2">
                            <button 
                                onClick={(e) => handleButtonClick(e, handleCancel)}
                                className="px-4 py-2 rounded-md bg-muted text-muted-foreground text-sm font-semibold hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={isLoading}
                                type="button"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={(e) => handleButtonClick(e, handleAddTopic)}
                                className="px-4 py-2 rounded-md bg-foreground text-background text-sm font-semibold hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2" 
                                disabled={!newTopicName.trim() || isLoading}
                                type="button"
                            >
                                {isLoading && (
                                    <div className="w-4 h-4 border-2 border-background border-t-transparent rounded-full animate-spin" />
                                )}
                                {isLoading ? 'Adding...' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {topics.length === 0 && !isAdding ? (
                <div className="text-center py-12 text-muted-foreground">
                    <div className="mb-4">
                        <Icon name="bell" className="w-12 h-12 mx-auto opacity-50" />
                    </div>
                    <p className="text-sm font-medium">No topics configured.</p>
                    <p className="text-xs mt-1">Click 'Add Topic' to start receiving notifications.</p>
                </div>
            ) : (
                <div className="space-y-3 pt-2">
                    {topics.map(topic => (
                        <div 
                            key={topic.id} 
                            className="p-4 rounded-lg border border-border bg-secondary/50 hover:bg-secondary/70 transition-colors"
                            onClick={handleContainerClick}
                        >
                            <div className="flex items-center justify-between">
                                <div className="pr-4 flex-1 min-w-0">
                                    <p className="font-semibold text-foreground truncate">
                                        {topic.name}
                                    </p>
                                    {topic.description && (
                                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                            {topic.description}
                                        </p>
                                    )}
                                    <div className="flex items-center gap-2 mt-2">
                                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                            topic.subscribed 
                                                ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' 
                                                : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                                        }`}>
                                            {topic.subscribed ? 'Subscribed' : 'Not subscribed'}
                                        </span>
                                    </div>
                                </div>
                                
                                <div className="flex-shrink-0">
                                    <button 
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleToggleSubscription(topic);
                                        }}
                                        className={`
                                            relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full 
                                            transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2
                                            disabled:opacity-50 disabled:cursor-not-allowed
                                            ${topic.subscribed ? 'bg-primary' : 'bg-muted'}
                                        `}
                                        disabled={isLoading}
                                        aria-label={`${topic.subscribed ? 'Unsubscribe from' : 'Subscribe to'} ${topic.name}`}
                                        type="button"
                                    >
                                        <span 
                                            className={`
                                                inline-block h-5 w-5 transform rounded-full bg-white transition-transform
                                                ${topic.subscribed ? 'translate-x-6' : 'translate-x-1'}
                                            `} 
                                        />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            
            {topics.length > 0 && (
                <div className="mt-6 p-4 bg-muted/30 rounded-lg">
                    <p className="text-xs text-muted-foreground">
                        <Icon name="info" className="w-3 h-3 inline mr-1" />
                        You'll receive notifications for subscribed topics only. 
                        {topics.filter(t => t.subscribed).length === 0 && (
                            <span className="text-amber-600 dark:text-amber-400 font-medium"> Subscribe to at least one topic to receive alerts.</span>
                        )}
                    </p>
                </div>
            )}
        </div>
    );
};
