import React, { useState, useMemo, useEffect } from 'react';
import { Notification, Severity, Topic, NotificationStatus, Session, NotificationUpdatePayload, User } from '../../types';
import { SEVERITY_INFO, STATUS_INFO } from '../../constants';
import { Icon } from '../ui/Icon';
import { NotificationDetail } from './NotificationDetail';
import { supabase } from '../../lib/supabaseClient';

interface RecentNotificationsProps {
    notifications: Notification[];
    onUpdateNotification: (notificationId: string, updates: NotificationUpdatePayload) => Promise<void>;
    onAddComment: (notificationId: string, text: string) => Promise<void>;
    topics: Topic[];
    session: Session;
}

export const RecentNotifications: React.FC<RecentNotificationsProps> = ({ 
    notifications, 
    onUpdateNotification, 
    onAddComment, 
    topics, 
    session 
}) => {
    const [severityFilter, setSeverityFilter] = useState<Severity | 'all'>('all');
    const [timeFilter, setTimeFilter] = useState<'all' | '1h' | '6h' | '24h'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
    const [infoModalNotification, setInfoModalNotification] = useState<Notification | null>(null);
    const [subscribers, setSubscribers] = useState<User[]>([]);
    const [loadingSubscribers, setLoadingSubscribers] = useState(false);
    const [userNames, setUserNames] = useState<Map<string, string>>(new Map());

    useEffect(() => {
        const fetchUserNames = async () => {
            const userIds = new Set<string>();
            notifications.forEach(n => {
                (n.comments || []).forEach(c => {
                    if (c.user_id) {
                        userIds.add(c.user_id);
                    }
                });
            });

            if (userIds.size > 0) {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('id, full_name')
                    .in('id', Array.from(userIds));

                if (error) {
                    console.error('Error fetching user names:', error);
                } else {
                    const names = new Map<string, string>();
                    data.forEach(profile => {
                        names.set(profile.id, profile.full_name || 'Unknown User');
                    });
                    setUserNames(names);
                }
            }
        };

        fetchUserNames();
    }, [notifications]);

    
    useEffect(() => {
        const fetchSubscribers = async () => {
            if (!infoModalNotification || !infoModalNotification.topic_id) {
                setSubscribers([]);
                return;
            }

            setLoadingSubscribers(true);
            try {
                const { data, error } = await supabase.functions.invoke('get-topic-subscribers-info', {
                    body: { topic_id: infoModalNotification.topic_id },
                });

                if (error) throw error;
                setSubscribers(data || []);
            } catch (error) {
                console.error('Error fetching subscribers:', error);
                setSubscribers([]);
            } finally {
                setLoadingSubscribers(false);
            }
        };

        fetchSubscribers();
    }, [infoModalNotification]);

    const filteredNotifications = useMemo(() => {
        const subscribedTopicIds = new Set(topics.filter(t => t.subscribed).map(t => t.id));
        
        let notifs = [...notifications].filter(n => 
            !n.topic_id || subscribedTopicIds.has(n.topic_id)
        );

        if (severityFilter !== 'all') {
            notifs = notifs.filter(n => n.severity === severityFilter);
        }

        if (timeFilter !== 'all') {
            const now = new Date();
            const filterDate = new Date();
            switch (timeFilter) {
                case '1h':
                    filterDate.setHours(now.getHours() - 1);
                    break;
                case '6h':
                    filterDate.setHours(now.getHours() - 6);
                    break;
                case '24h':
                    filterDate.setHours(now.getHours() - 24);
                    break;
            }
            notifs = notifs.filter(n => new Date(n.timestamp) > filterDate);
        }

        if (searchTerm) {
            const lowercasedFilter = searchTerm.toLowerCase();
            notifs = notifs.filter(n =>
                n.title.toLowerCase().includes(lowercasedFilter) ||
                (n.message && n.message.toLowerCase().includes(lowercasedFilter))
            );
        }
        
        return notifs.sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }, [notifications, severityFilter, timeFilter, searchTerm, topics]);

    const handleQuickAcknowledge = async (e: React.MouseEvent, notification: Notification) => {
        e.stopPropagation();
        
        if (processingIds.has(notification.id)) return;
        if (notification.status === 'acknowledged') return;
        
        setProcessingIds(prev => new Set([...prev, notification.id]));
        
        try {
            await onUpdateNotification(notification.id, { status: 'acknowledged' });
        } catch (error) {
            console.error('Error acknowledging notification:', error);
            alert('Failed to acknowledge the notification. Please try again.');
        } finally {
            setTimeout(() => {
                setProcessingIds(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(notification.id);
                    return newSet;
                });
            }, 1000);
        }
    };

    const handleQuickResolve = async (e: React.MouseEvent, notification: Notification) => {
        e.stopPropagation();

        if (processingIds.has(notification.id)) return;
        if (notification.status === 'resolved') return;

        setProcessingIds(prev => new Set([...prev, notification.id]));
        
        try {
            await onUpdateNotification(notification.id, { status: 'resolved' });
        } catch (error) {
            console.error('Error resolving notification:', error);
            alert('Failed to resolve the notification. Please try again.');
        } finally {
            setTimeout(() => {
                setProcessingIds(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(notification.id);
                    return newSet;
                });
            }, 1000);
        }
    };

    return (
        <div className="bg-gradient-to-br from-card to-secondary/20 rounded-xl border border-border shadow-lg shadow-black/5 h-full max-h-[calc(100vh-8rem)] flex flex-col">
            <div className="p-4 border-b border-border flex-shrink-0">
                <h3 className="text-xl font-semibold mb-4">Recent Notifications</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div className="relative md:col-span-1">
                         <Icon name="search" className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                        <input 
                            type="text"
                            placeholder="Search alerts..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 text-sm rounded-md border-border shadow-sm focus:border-ring focus:ring-ring bg-transparent"
                        />
                    </div>
                    <select 
                        value={severityFilter}
                        onChange={(e) => setSeverityFilter(e.target.value as Severity | 'all')}
                        className="text-sm rounded-md border-border shadow-sm focus:border-ring focus:ring-ring bg-transparent"
                    >
                        <option value="all">All Severities</option>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                    </select>
                    <select 
                        value={timeFilter}
                        onChange={(e) => setTimeFilter(e.target.value as 'all' | '1h' | '6h' | '24h')}
                        className="text-sm rounded-md border-border shadow-sm focus:border-ring focus:ring-ring bg-transparent"
                    >
                        <option value="all">All Time</option>
                        <option value="1h">Last Hour</option>
                        <option value="6h">Last 6 Hours</option>
                        <option value="24h">Last 24 Hours</option>
                    </select>
                </div>
            </div>
            
            <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="p-2 space-y-2">
                    {filteredNotifications.length === 0 ? (
                        <div className="text-center py-16 text-muted-foreground">
                            <p>No notifications match your filters.</p>
                            <p className="text-sm mt-1">Try sending a test alert or adjusting filters!</p>
                        </div>
                    ) : filteredNotifications.map(n => {
                        const isProcessing = processingIds.has(n.id);
                        
                        return (
                            <div key={n.id} className="bg-card rounded-lg overflow-hidden transition-shadow duration-300 hover:shadow-2xl border border-border">
                                <div 
                                    className={`p-4 cursor-pointer transition-colors hover:bg-accent/50 ${expandedId === n.id ? 'bg-accent/50' : ''}`} 
                                    onClick={() => setExpandedId(expandedId === n.id ? null : n.id)}
                                >
                                    <div className="grid grid-cols-[2rem,1fr,auto] gap-4 items-start">
                                        <div>
                                            <Icon name={SEVERITY_INFO[n.severity].icon} className={`w-8 h-8 ${SEVERITY_INFO[n.severity].color}`} />
                                        </div>
                                        <div className="min-w-0">
                                            <h4 className="font-semibold text-base text-foreground truncate pr-4">{n.title}</h4>
                                            <p className="text-sm text-muted-foreground mt-1 truncate">{n.message}</p>
                                            <div className="flex items-center gap-3 mt-3">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full ${STATUS_INFO[n.status].bg} ${STATUS_INFO[n.status].text} capitalize`}>
                                                    {n.status === 'new' && !isProcessing && <div className="w-2 h-2 rounded-full bg-destructive animate-blink"></div>}
                                                    {isProcessing && <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin"></div>}
                                                    <Icon name={STATUS_INFO[n.status].icon} className="w-3.5 h-3.5" />
                                                    {isProcessing ? 'Processing...' : n.status}
                                                </span>
                                                <button 
                                                    className="ml-2 p-1 text-gray-400 hover:text-gray-600" 
                                                    onClick={(e) => { 
                                                        e.stopPropagation(); 
                                                        setInfoModalNotification(n); 
                                                    }}
                                                    title="Show delivery info"
                                                >
                                                    <Icon name="info-circle" className="h-5 w-5" />
                                                </button>
                                                {n.comments && n.comments.length > 0 && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground bg-muted rounded-full">
                                                        <Icon name="message-circle" className="w-3 h-3" />
                                                        {n.comments.length}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                             <p className="text-xs text-muted-foreground flex-shrink-0">{new Date(n.timestamp).toLocaleString([], {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}</p>
                                            
                                            <div className="flex gap-1">
                                                {n.status === 'new' && !isProcessing && (
                                                    
                                                        <button
                                                            onClick={(e) => handleQuickAcknowledge(e, n)}
                                                            className="p-1.5 rounded-full text-muted-foreground hover:bg-yellow-100 hover:text-yellow-600 dark:hover:bg-yellow-900/30 dark:hover:text-yellow-400 transition-colors"
                                                            title="Quick Acknowledge"
                                                            disabled={isProcessing}
                                                        >
                                                            <Icon name="check" className="w-4 h-4" />
                                                        </button>
                                                       
                                                   
                                                )}
                                                {n.status === 'acknowledged' && !isProcessing && (
                                                    <button
                                                        onClick={(e) => handleQuickResolve(e, n)}
                                                        className="p-1.5 rounded-full text-muted-foreground hover:bg-green-100 hover:text-green-600 dark:hover:bg-green-900/30 dark:hover:text-green-400 transition-colors"
                                                        title="Quick Resolve"
                                                        disabled={isProcessing}
                                                    >
                                                        <Icon name="check-check" className="w-4 h-4" />
                                                    </button>
                                                )}
                                                {isProcessing && (
                                                    <div className="p-1.5 rounded-full">
                                                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin text-muted-foreground"></div>
                                                    </div>
                                                )}
                                            </div>
                                            <Icon name={expandedId === n.id ? 'chevron-up' : 'chevron-down'} className="ml-4" />
                                        </div>
                                    </div>
                                </div>
                                {expandedId === n.id && (
                                    <NotificationDetail 
                                        notification={n}
                                        onUpdateNotification={onUpdateNotification}
                                        onAddComment={onAddComment}
                                        session={session}
                                        userNames={userNames}
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
            {infoModalNotification && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setInfoModalNotification(null)}>
                    <div className="bg-card text-card-foreground p-6 rounded-lg shadow-xl max-w-md w-full" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-semibold flex items-center">
                                <Icon name="share-alt" className="mr-2" />
                                Delivery Information
                            </h3>
                            <button onClick={() => setInfoModalNotification(null)} className="p-1 rounded-full hover:bg-accent">
                                <Icon name="close" className="h-6 w-6 text-muted-foreground" />
                            </button>
                        </div>
                        {(() => {
                            const topic = topics.find(t => t.id === infoModalNotification.topic_id);
                            return (
                                <div>
                                    <p className="text-muted-foreground mb-2">
                                        This notification was sent to all subscribers of the topic:
                                    </p>
                                    <div className="bg-accent p-3 rounded-md">
                                        <p className="font-semibold text-lg">
                                            {topic ? topic.name : 'Unknown Topic'}
                                        </p>
                                        {topic && <p className="text-sm text-muted-foreground">{topic.description}</p>}
                                    </div>
                                    
                                    <div className="mt-4">
                                        <h4 className="font-semibold mb-2">Recipients ({subscribers.length})</h4>
                                        {loadingSubscribers ? (
                                             <div className="space-y-2">
                                                {[...Array(3)].map((_, i) => (
                                                    <div key={i} className="flex items-center gap-3 bg-secondary/50 p-2 rounded-md animate-pulse">
                                                        <div className="w-8 h-8 rounded-full bg-muted"></div>
                                                        <div className="flex-1">
                                                            <div className="h-4 bg-muted rounded w-3/4"></div>
                                                            <div className="h-3 bg-muted rounded w-1/2 mt-1"></div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : subscribers.length > 0 ? (
                                            <div className="space-y-2 max-h-48 overflow-y-auto pr-2 -mr-2">
                                                {subscribers.map(user => {
                                                    const userInitial = (user.full_name || user.email || 'A')[0].toUpperCase();
                                                    return (
                                                        <div key={user.id} className="flex items-center gap-3 bg-secondary/50 p-2 rounded-md">
                                                           <div className="w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center font-bold text-sm flex-shrink-0">
                                                                {userInitial}
                                                            </div>
                                                            <div>
                                                                <p className="font-medium text-sm text-foreground">{user.full_name || 'Unknown User'}</p>
                                                                <p className="text-xs text-muted-foreground">{user.email}</p>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-muted-foreground text-center py-4">No subscribers for this topic.</p>
                                        )}
                                    </div>
                                </div>
                            );
                        })()}
                        <div className="mt-6 flex justify-end">
                            <button 
                                className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 focus:outline-none focus:ring-2 focus:ring-ring"
                                onClick={() => setInfoModalNotification(null)}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
