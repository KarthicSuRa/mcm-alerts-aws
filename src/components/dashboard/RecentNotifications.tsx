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

    // Enhanced quick action handlers with better state management and error handling
    const handleQuickAcknowledge = async (e: React.MouseEvent, notification: Notification) => {
        e.stopPropagation();
        
        // Prevent multiple clicks
        if (processingIds.has(notification.id)) {
            console.log('Already processing notification:', notification.id);
            return;
        }
        
        // Check if already acknowledged
        if (notification.status === 'acknowledged') {
            console.log('Notification already acknowledged:', notification.id);
            return;
        }
        
        setProcessingIds(prev => new Set([...prev, notification.id]));
        
        try {
            console.log('🔧 Quick acknowledging notification:', {
                id: notification.id,
                currentStatus: notification.status,
                targetStatus: 'acknowledged'
            });
            
            await onUpdateNotification(notification.id, { 
                status: 'acknowledged'
            });
            
            console.log('✅ Notification acknowledgment completed successfully');
            
        } catch (error) {
            console.error('❌ Error acknowledging notification:', error);
            
            // More user-friendly error messages
            let errorMessage = 'Failed to acknowledge notification. ';
            if (error instanceof Error) {
                if (error.message.includes('PGRST116')) {
                    errorMessage += 'Notification may have been deleted or is no longer available.';
                } else if (error.message.includes('permission')) {
                    errorMessage += 'You do not have permission to modify this notification.';
                } else {
                    errorMessage += 'Please try again or refresh the page.';
                }
            }
            alert(errorMessage);
        } finally {
            // Remove from processing set after a short delay
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
        
        // Prevent multiple clicks
        if (processingIds.has(notification.id)) {
            console.log('Already processing notification:', notification.id);
            return;
        }
        
        // Check if already resolved
        if (notification.status === 'resolved') {
            console.log('Notification already resolved:', notification.id);
            return;
        }
        
        setProcessingIds(prev => new Set([...prev, notification.id]));
        
        try {
            console.log('🔧 Quick resolving notification:', {
                id: notification.id,
                currentStatus: notification.status,
                targetStatus: 'resolved'
            });
            
            await onUpdateNotification(notification.id, { 
                status: 'resolved'
            });
            
            console.log('✅ Notification resolution completed successfully');
            
        } catch (error) {
            console.error('❌ Error resolving notification:', error);
            
            // More user-friendly error messages
            let errorMessage = 'Failed to resolve notification. ';
            if (error instanceof Error) {
                if (error.message.includes('PGRST116')) {
                    errorMessage += 'Notification may have been deleted or is no longer available.';
                } else if (error.message.includes('permission')) {
                    errorMessage += 'You do not have permission to modify this notification.';
                } else {
                    errorMessage += 'Please try again or refresh the page.';
                }
            }
            alert(errorMessage);
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
        <div className="bg-gradient-to-br from-card to-secondary/20 rounded-xl border border-border shadow-lg shadow-black/5 h-full max-h-[calc(100vh-8rem)] flex flex-col">
            {/* Fixed Header - doesn't scroll */}
            <div className="p-4 border-b border-border flex-shrink-0">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold">Recent Notifications</h3>
                    <button 
                        onClick={handleClearLogs}
                        className="flex items-center gap-2 text-sm font-semibold text-red-600 hover:text-red-700 transition-colors"
                    >
                        <Icon name="trash" className="w-5 h-5" />
                        Clear Logs
                    </button>
                </div>
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
            
            {/* Scrollable Content Area */}
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
                                                {n.comments && n.comments.length > 0 && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground bg-muted rounded-full">
                                                        <Icon name="message-circle" className="w-3 h-3" />
                                                        {n.comments.length}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                             <p className="text-xs text-muted-foreground flex-shrink-0">{new Date(n.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                                            
                                            {/* Quick Action Buttons */}
                                            <div className="flex gap-1">
                                                {n.status === 'new' && !isProcessing && (
                                                    <>
                                                        <button
                                                            onClick={(e) => handleQuickAcknowledge(e, n)}
                                                            className="p-1.5 rounded-full text-muted-foreground hover:bg-yellow-100 hover:text-yellow-600 dark:hover:bg-yellow-900/30 dark:hover:text-yellow-400 transition-colors"
                                                            title="Quick Acknowledge"
                                                            disabled={isProcessing}
                                                        >
                                                            <Icon name="check" className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={(e) => handleQuickResolve(e, n)}
                                                            className="p-1.5 rounded-full text-muted-foreground hover:bg-green-100 hover:text-green-600 dark:hover:bg-green-900/30 dark:hover:text-green-400 transition-colors"
                                                            title="Quick Resolve"
                                                            disabled={isProcessing}
                                                        >
                                                            <Icon name="check-check" className="w-4 h-4" />
                                                        </button>
                                                    </>
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
