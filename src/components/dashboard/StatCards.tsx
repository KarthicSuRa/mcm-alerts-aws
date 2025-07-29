

import React, { useMemo } from 'react';
import { Notification, NotificationStatus } from '../../types';
import { Icon } from '../ui/Icon';

interface StatCardsProps {
    notifications: Notification[];
}

const StatCard: React.FC<{ title: string; value: number | string; icon: string; accentColor: string; }> = ({ title, value, icon, accentColor }) => (
    <div className={`p-6 rounded-xl flex flex-col gap-4 bg-gradient-to-br from-card to-secondary/20 border-border border shadow-lg shadow-black/5 transition-all hover:shadow-xl hover:-translate-y-1 border-t-4 ${accentColor}`}>
        <div className="flex justify-between items-center">
            <p className="text-base text-muted-foreground font-semibold">{title}</p>
            <Icon name={icon} className="w-6 h-6 text-muted-foreground" />
        </div>
        <div>
            <p className="text-4xl font-bold text-foreground">{value}</p>
        </div>
    </div>
);

export const StatCards: React.FC<StatCardsProps> = ({ notifications }) => {
    const stats = useMemo(() => ({
        new: notifications.filter(n => n.status === 'new').length,
        acknowledged: notifications.filter(n => n.status === 'acknowledged').length,
        resolved: notifications.filter(n => n.status === 'resolved').length,
    }), [notifications]);

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard title="New Alerts" value={stats.new} icon="alert" accentColor="border-destructive" />
            <StatCard title="Acknowledged" value={stats.acknowledged} icon="check-circle" accentColor="border-success" />
            <StatCard title="Resolved" value={stats.resolved} icon="shield-check" accentColor="border-primary" />
        </div>
    );
};
