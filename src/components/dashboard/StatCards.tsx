import React, { useMemo } from 'react';
import { Notification } from '../../types';
import { Icon } from '../ui/Icon';

interface StatCardsProps {
    notifications: Notification[];
}

const StatCard: React.FC<{ title: string; value: number | string; icon: string; bgColor: string; }> = ({ title, value, icon, bgColor }) => (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
        <div className="p-5 flex items-center">
            <div className={`flex-shrink-0 ${bgColor} p-3 rounded-lg`}>
                <Icon name={icon} className="h-6 w-6 text-white" />
            </div>
            <div className="ml-5 w-0 flex-1">
                <dl>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">{title}</dt>
                    <dd>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
                    </dd>
                </dl>
            </div>
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
            <StatCard title="New Alerts" value={stats.new} icon="alert" bgColor="bg-red-500" />
            <StatCard title="Acknowledged" value={stats.acknowledged} icon="check-circle" bgColor="bg-green-500" />
            <StatCard title="Resolved" value={stats.resolved} icon="shield-check" bgColor="bg-blue-500" />
        </div>
    );
};
