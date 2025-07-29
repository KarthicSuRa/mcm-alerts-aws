

import React, { useState, useMemo } from 'react';
import { Notification, Severity, Topic, NotificationStatus, Session, NotificationUpdatePayload } from '../../types';
import { SEVERITY_INFO, STATUS_INFO } from '../../constants';
import { Icon } from '../ui/Icon';
import { NotificationDetail } from './NotificationDetail';

interface RecentNotificationsProps {
    notifications: Notification[];
    onUpdateNotification: (notificationId: string, updates: NotificationUpdatePayload) => void;
    onAddComment: (notificationId: string, text: string) => void;
    topics: Topic[];
    session: Session;
}

export const RecentNotifications: React.FC<RecentNotificationsProps> = ({ notifications, onUpdateNotification, onAddComment, topics, session }) => {
    const [severityFilter, setSeverityFilter] = useState<Severity | 'all'>('all');
    const [timeFilter, setTimeFilter] = useState<'all' | '1h' | '6h' | '24h'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedId, setExpandedId] = useState<string | null>(null);
    
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

    const handleQuickAcknowledge = (e: React.MouseEvent, notification: Notification) => {
        e.stopPropagation();
        onAddComment(notification.id, `Status changed to acknowledged.`);
        onUpdateNotification(notification.id, { status: 'acknowledged' });
    };

    return (
        <div className="bg-gradient-to-br from-card to-secondary/20 rounded-xl border border-border shadow-lg shadow-black/5 h-full flex flex-col">
            <div className="p-4 border-b border-border">
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
            <div className="flex-1 p-2 space-y-2 min-h-0 overflow-y-auto">
                {filteredNotifications.length === 0 ? (
                    <div className="text-center py-16 text-muted-foreground">
                        <p>No notifications match your filters.</p>
                        <p className="text-sm mt-1">Try sending a test alert or adjusting filters!</p>
                    </div>
                ) : filteredNotifications.map(n => {
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
                                                {n.status === 'new' && <div className="w-2 h-2 rounded-full bg-destructive animate-blink"></div>}
                                                <Icon name={STATUS_INFO[n.status].icon} className="w-3.5 h-3.5" />
                                                {n.status}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                         <p className="text-xs text-muted-foreground flex-shrink-0">{new Date(n.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                                        {n.status === 'new' && (
                                            <button
                                                onClick={(e) => handleQuickAcknowledge(e, n)}
                                                className="p-1.5 rounded-full text-muted-foreground hover:bg-accent hover:text-primary"
                                                title="Quick Acknowledge"
                                            >
                                                <Icon name="check" className="w-5 h-5" />
                                            </button>
                                        )}
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
    );
};
