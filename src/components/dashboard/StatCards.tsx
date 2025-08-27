import React, { useMemo } from 'react';
import { Notification, NotificationStatus } from '../../types';
import { Icon } from '../ui/Icon';

interface StatCardsProps {
    notifications: Notification[];
}

const StatCard: React.FC<{ 
  title: string; 
  value: number | string; 
  icon: string; 
  accentColor: string;
  bgColor: string;
}> = ({ title, value, icon, accentColor, bgColor }) => (
  <div className={`group relative p-4 rounded-xl ${bgColor} border border-white/10 shadow-sm hover:shadow-md transition-all duration-200 hover:scale-[1.02]`}>
    <div className={`absolute top-0 left-0 right-0 h-0.5 ${accentColor} rounded-t-xl`}></div>
    
    <div className="flex items-center justify-between mb-2">
      <div className={`p-1.5 rounded-lg ${accentColor}/10`}>
        <Icon name={icon} className="w-4 h-4 text-current" />
      </div>
      <div className={`w-1.5 h-1.5 rounded-full ${accentColor} opacity-60`}></div>
    </div>
    
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-1">{title}</p>
      <p className="text-2xl font-bold text-foreground">{value}</p>
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
    <div className="grid grid-cols-3 gap-3">
      <StatCard 
        title="New" 
        value={stats.new} 
        icon="alert" 
        accentColor="bg-red-500"
        bgColor="bg-card"
      />
      <StatCard 
        title="Acknowledged" 
        value={stats.acknowledged} 
        icon="check-circle" 
        accentColor="bg-green-500"
        bgColor="bg-card"
      />
      <StatCard 
        title="Resolved" 
        value={stats.resolved} 
        icon="shield-check" 
        accentColor="bg-blue-500"
        bgColor="bg-card"
      />
    </div>
  );
};
