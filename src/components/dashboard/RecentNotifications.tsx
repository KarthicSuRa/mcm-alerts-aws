import React, { useState, useMemo } from 'react';
import { Notification, Severity, Topic, NotificationStatus, Session, NotificationUpdatePayload } from '../../types';
import { SEVERITY_INFO, STATUS_INFO } from '../../constants';
import { Icon } from '../ui/Icon';
import { NotificationDetail } from './NotificationDetail';

interface RecentNotificationsProps {
    notifications: Notification[];
    onUpdateNotification: (notificationId: string, updates: NotificationUpdatePayload) => Promise<void>;
    onAddComment: (notificationId: string, text: string) => Promise<void>;
    onClearLogs: () => Promise<void>;
    topics: Topic[];
    session: Session | null;
}

export const RecentNotifications: React.FC<RecentNotificationsProps> = ({ 
    notifications, 
    onUpdateNotification, 
    onAddComment, 
    onClearLogs,
    topics, 
    session 
}) => {
    const [severityFilter, setSeverityFilter] = useState<Severity | 'all'>('all');
    const [timeFilter, setTimeFilter] = useState<'all' | '1h' | '6h' | '24h'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
    
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

    const handleClearLogs = () => {
        if (window.confirm('Are you sure you want to clear all notifications? This action cannot be undone.')) {
            onClearLogs();
        }
    };

    const handleQuickAction = async (notification: Notification, status: NotificationStatus) => {
        if (processingIds.has(notification.id) || notification.status === status) {
            return;
        }

        setProcessingIds(prev => new Set([...prev, notification.id]));

        try {
            await onUpdateNotification(notification.id, { status });
        } catch (error) {
            console.error(`Error updating notification to ${status}:`, error);
            alert(`Failed to update notification. Please check permissions and network status.`);
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

    if (!session) {
        return <div>Loading...</div>
    }

    return (
        <div className="bg-card border border-border rounded-xl shadow-sm h-full max-h-[calc(100vh-8rem)] flex flex-col @container">
            {/* Fixed Header */}
            <div className="p-4 border-b border-border flex-shrink-0">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg sm:text-xl font-bold">Recent Notifications</h3>
                    <button 
                        onClick={handleClearLogs}
                        className="flex items-center gap-2 text-sm font-semibold text-red-500 hover:text-red-600 transition-colors"
                    >
                        <Icon name="trash" className="w-4 h-4" />
                        <span className="hidden sm:inline">Clear Logs</span>
                    </button>
                </div>
                <div className="flex flex-wrap gap-2">
                    <div className="relative flex-grow min-w-[150px]">
                         <Icon name="search" className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                        <input 
                            type="text"
                            placeholder="Search..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 text-sm rounded-md border-border shadow-sm focus:border-ring focus:ring-ring bg-background"
                        />
                    </div>
                    <select 
                        value={severityFilter}
                        onChange={(e) => setSeverityFilter(e.target.value as Severity | 'all')}
                        className="text-sm rounded-md border-border shadow-sm focus:border-ring focus:ring-ring bg-background flex-grow min-w-[120px]"
                    >
                        <option value="all">All Severities</option>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                    </select>
                    <select 
                        value={timeFilter}
                        onChange={(e) => setTimeFilter(e.target.value as 'all' | '1h' | '6h' | '24h')}
                        className="text-sm rounded-md border-border shadow-sm focus:border-ring focus:ring-ring bg-background flex-grow min-w-[120px]"
                    >
                        <option value="all">All Time</option>
                        <option value="1h">Last Hour</option>
                        <option value="6h">Last 6 Hours</option>
                        <option value="24h">Last 24 Hours</option>
                    </select>
                </div>
            </div>
            
            {/* Scrollable Content */}
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
                            <div key={n.id} className="bg-card rounded-lg overflow-hidden transition-shadow duration-300 hover:shadow-md border border-border/80">
                                <div 
                                    className={`p-3 @lg:p-4 cursor-pointer transition-colors hover:bg-accent/50 ${expandedId === n.id ? 'bg-accent/50' : ''}`} 
                                    onClick={() => setExpandedId(expandedId === n.id ? null : n.id)}
                                >
                                    <div className="grid grid-cols-[2rem,1fr,auto] gap-3 @lg:gap-4 items-start">
                                        <div>
                                            <Icon name={SEVERITY_INFO[n.severity].icon} className={`w-7 h-7 @lg:w-8 @lg:h-8 ${SEVERITY_INFO[n.severity].color}`} />
                                        </div>
                                        <div className="min-w-0">
                                            <h4 className="font-semibold text-base text-foreground truncate pr-2 @lg:pr-4">{n.title}</h4>
                                            <p className="text-sm text-muted-foreground mt-1 truncate hidden @sm:block">{n.message}</p>
                                            <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-3">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full ${STATUS_INFO[n.status].bg} ${STATUS_INFO[n.status].text} capitalize`}>
                                                    {n.status === 'new' && !isProcessing && <div className="w-2 h-2 rounded-full bg-destructive animate-blink"></div>}
                                                    {isProcessing && <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></div>}
                                                    <Icon name={STATUS_INFO[n.status].icon} className="w-3.5 h-3.5" />
                                                    {isProcessing ? 'Processing...' : n.status}
                                                </span>
                                                {n.comments && n.comments.length > 0 && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground bg-muted rounded-full">
                                                        <Icon name="message-circle" className="w-3 h-3" />
                                                        {n.comments.length}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end justify-between self-stretch">
                                            <p className="text-xs text-muted-foreground flex-shrink-0">{new Date(n.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                                            
                                            <div className="flex gap-1 mt-2">
                                                {n.status === 'new' && !isProcessing && (
                                                    <>
                                                        <button
                                                            onClick={(e) => {e.stopPropagation(); handleQuickAction(n, 'acknowledged')}}
                                                            className="p-1.5 rounded-full text-muted-foreground hover:bg-yellow-100 hover:text-yellow-600 dark:hover:bg-yellow-900/30 dark:hover:text-yellow-400 transition-colors"
                                                            title="Acknowledge"
                                                        >
                                                            <Icon name="check" className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={(e) => {e.stopPropagation(); handleQuickAction(n, 'resolved')}}
                                                            className="p-1.5 rounded-full text-muted-foreground hover:bg-green-100 hover:text-green-600 dark:hover:bg-green-900/30 dark:hover:text-green-400 transition-colors"
                                                            title="Resolve"
                                                        >
                                                            <Icon name="check-check" className="w-4 h-4" />
                                                        </button>
                                                    </>
                                                )}
                                                {n.status === 'acknowledged' && !isProcessing && (
                                                     <button
                                                        onClick={(e) => {e.stopPropagation(); handleQuickAction(n, 'resolved')}}
                                                        className="p-1.5 rounded-full text-muted-foreground hover:bg-green-100 hover:text-green-600 dark:hover:bg-green-900/30 dark:hover:text-green-400 transition-colors"
                                                        title="Resolve"
                                                    >
                                                        <Icon name="check-check" className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                {expandedId === n.id && (
                                    <NotificationDetail 
                                        notification={n}
                                        onUpdateNotification={onUpdateNotification}
                                        onAddComment={onAddComment}
                                        session={session}
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
