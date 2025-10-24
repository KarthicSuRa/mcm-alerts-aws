import React, { useMemo, useEffect, useState } from 'react';
import { Notification, Comment, User } from '../../types';
import { Icon } from '../ui/Icon';
import { awsClient } from '../../lib/awsClient';

interface ActivityFeedProps {
    notifications: Notification[];
}

type ActivityItem = {
    id: string;
    type: 'creation' | 'comment';
    timestamp: string;
    notificationTitle: string;
    text: string;
    userName: string;
}

const getActionFromComment = (comment: Comment): { action: string, text: string } => {
    const statusChangeRegex = /Status changed to (new|acknowledged|resolved|Re-opened)\\./i;
    const match = comment.text.match(statusChangeRegex);
    if (match) {
        return { action: match[1], text: comment.text };
    }
    return { action: 'Comment', text: `Commented: \"${comment.text}\"`};
}

const getActionStyling = (action: string) => {
    switch(action.toLowerCase()) {
        case 'new': return { icon: 'alert-circle', iconBg: 'bg-destructive/10', iconText: 'text-destructive', border: 'border-destructive' };
        case 'acknowledged': return { icon: 'check-circle', iconBg: 'bg-success/10', iconText: 'text-success', border: 'border-success' };
        case 'resolved': return { icon: 'shield-check', iconBg: 'bg-primary/10', iconText: 'text-primary', border: 'border-primary' };
        case 're-opened': return { icon: 'refresh-cw', iconBg: 'bg-primary/10', iconText: 'text-primary', border: 'border-primary' };
        default: return { icon: 'messageSquare', iconBg: 'bg-muted', iconText: 'text-muted-foreground', border: 'border-transparent' };
    }
}

const groupActivitiesByDate = (activities: ActivityItem[]) => {
    const groups = new Map<string, ActivityItem[]>();
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const todayStr = today.toDateString();
    const yesterdayStr = yesterday.toDateString();

    activities.forEach(item => {
        const itemDate = new Date(item.timestamp);
        const itemDateStr = itemDate.toDateString();
        let key = itemDate.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

        if (itemDateStr === todayStr) key = 'Today';
        else if (itemDateStr === yesterdayStr) key = 'Yesterday';
        
        if (!groups.has(key)) {
            groups.set(key, []);
        }
        groups.get(key)!.push(item);
    });

    return Array.from(groups.entries());
};

export const ActivityFeed: React.FC<ActivityFeedProps> = ({ notifications }) => {
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
                try {
                    const users = await awsClient.get(`/users?ids=${Array.from(userIds).join(',')}`);
                    const names = new Map<string, string>();
                    users.forEach((user: User) => {
                        names.set(user.id, user.full_name || 'Unknown User');
                    });
                    setUserNames(names);
                } catch (error) {
                    console.error('Error fetching user names:', error);
                }
            }
        };

        fetchUserNames();
    }, [notifications]);
    
    const activityStream = useMemo(() => {
        const stream: ActivityItem[] = [];
        
        notifications.forEach(n => {
            stream.push({
                id: `creation-${n.id}`,
                type: 'creation',
                timestamp: n.created_at,
                notificationTitle: n.title,
                text: `Alert created: \"${n.title}\"`,
                userName: 'System'
            });

            (n.comments || []).forEach((c: Comment) => {
                stream.push({
                    id: `comment-${c.id}`,
                    type: 'comment',
                    timestamp: c.created_at,
                    notificationTitle: n.title,
                    text: getActionFromComment(c).text,
                    userName: userNames.get(c.user_id) || 'Unknown User'
                });
            });
        });
        
        return stream.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }, [notifications, userNames]);
    
    const groupedActivities = useMemo(() => groupActivitiesByDate(activityStream), [activityStream]);


    return (
        <div className="bg-gradient-to-br from-card to-secondary/20 p-6 rounded-xl border border-border shadow-lg shadow-black/5 h-full">
            <div className="flex items-center gap-2 mb-4">
                <Icon name="trending-up" className="w-5 h-5" />
                <h3 className="text-xl font-bold">Live Activity Feed</h3>
            </div>
            <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                {groupedActivities.length > 0 ? groupedActivities.map(([date, activities]) => (
                    <div key={date}>
                        <h4 className="text-xs font-semibold uppercase text-muted-foreground my-3 pb-1 border-b border-border">{date}</h4>
                        <ul className="-mb-4">
                            {activities.map((item, itemIdx) => {
                                const action = item.type === 'creation' ? 'new' : getActionFromComment({text: item.text} as Comment).action;
                                const styling = getActionStyling(action);
                                const isLast = itemIdx === activities.length - 1;
                                
                                return (
                                <li key={item.id} className="relative flex gap-4 pb-6">
                                    {!isLast && <div className="absolute left-[1.1rem] top-5 h-full w-0.5 bg-border -translate-x-1/2"></div>}
                                    <div className={`relative flex items-center justify-center w-9 h-9 rounded-full ${styling.iconBg}`}>
                                        <Icon name={styling.icon} className={`w-5 h-5 ${styling.iconText}`} />
                                    </div>
                                    <div className={`flex-1 p-3 rounded-md border-l-4 ${styling.border}`}>
                                        <p className="text-sm text-foreground">{item.text}</p>
                                        <p className="text-xs text-muted-foreground pt-1">{new Date(item.timestamp).toLocaleTimeString()} by {item.userName}</p>
                                    </div>
                                </li>
                                )
                            })}
                        </ul>
                    </div>
                )) : (
                    <p className="text-sm text-center text-muted-foreground py-8">No activity yet.</p>
                )}
            </div>
        </div>
    );
};
