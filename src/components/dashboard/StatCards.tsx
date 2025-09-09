import React, { useMemo } from 'react';
import { Notification, MonitoredSite } from '../../types';
import { Icon } from '../ui/Icon';

interface StatCardsProps {
    notifications: Notification[];
    sites: MonitoredSite[];
}

const StatCard: React.FC<{ title: string; value: number | string; icon: string; bgColor: string; }> = ({ title, value, icon, bgColor }) => (
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="p-5 flex items-center">
            <div className={`flex-shrink-0 ${bgColor} p-3 rounded-lg shadow`}>
                <Icon name={icon} className="h-6 w-6 text-white" />
            </div>
            <div className="ml-5 w-0 flex-1">
                <dl>
                    <dt className="text-sm font-medium text-muted-foreground truncate">{title}</dt>
                    <dd>
                        <div className="text-2xl font-bold text-foreground">{value}</div>
                    </dd>
                </dl>
            </div>
        </div>
    </div>
);

export const StatCards: React.FC<StatCardsProps> = ({ notifications, sites }) => {
    const stats = useMemo(() => ({
        new: notifications.filter(n => n.status === 'new').length,
        acknowledged: notifications.filter(n => n.status === 'acknowledged').length,
        resolved: notifications.filter(n => n.status === 'resolved').length,
    }), [notifications]);

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard title="Monitored Sites" value={sites.length} icon="monitor" bgColor="bg-indigo-500" />
            <StatCard title="New Alerts" value={stats.new} icon="bell" bgColor="bg-destructive" />
            <StatCard title="Acknowledged" value={stats.acknowledged} icon="check-circle" bgColor="bg-yellow-500" />
            <StatCard title="Resolved" value={stats.resolved} icon="shield-check" bgColor="bg-success" />
        </div>
    );
};
