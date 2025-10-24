import React, { useMemo } from 'react';
import { Header } from '../components/layout/Header';
import { RecentNotifications } from '../components/dashboard/RecentNotifications';
import { StatCards } from '../components/dashboard/StatCards';
import { Topic, Session, SystemStatusData, Notification, MonitoredSite, NotificationUpdatePayload } from '../types';
import { subDays, format } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface DashboardPageProps {
  topics: Topic[];
  session: Session | null;
  onAddTopic: (name: string, description: string, team_id: string | null) => Promise<void>;
  onToggleSubscription: (topic: Topic) => Promise<void>;
  onDeleteTopic: (topic: Topic) => Promise<void>;
  onNavigate: (page: string) => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  onLogout: () => Promise<void>;
  openSettings: () => void;
  systemStatus: SystemStatusData;
  notifications: Notification[];
  onUpdateNotification: (notificationId: string, updates: NotificationUpdatePayload) => Promise<void>;
  sites: MonitoredSite[];
  onAddComment: (notificationId: string, text: string) => Promise<void>;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ 
    topics, session, onNavigate, 
    isSidebarOpen, setIsSidebarOpen, onLogout, openSettings, systemStatus, notifications,
    onUpdateNotification, sites, onAddComment
}) => {

    const latencyData = useMemo(() => {
        // This part would require ping logs, which are not available in this component anymore
        // You would need to fetch or pass down ping logs to calculate latency data.
        // For now, returning an empty array.
        return [];
      }, []);

    return (
        <>
            <Header onNavigate={onNavigate} onLogout={onLogout} notifications={notifications} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} openSettings={openSettings} systemStatus={systemStatus} session={session} title="Dashboard" />
            <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900 md:ml-72">
                <div className="p-4 sm:p-6 lg:p-8">
                    <div className="mb-8">
                        <StatCards 
                            notifications={notifications}
                            sites={sites}
                        />
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 mb-8">
                        <div className="xl:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                            <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Site Latency (24h)</h3>
                            {latencyData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={250}>
                                    <BarChart data={latencyData}>
                                        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                                        <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                                        <YAxis fontSize={12} tickLine={false} axisLine={false} unit="ms" />
                                        <Tooltip cursor={{fill: 'rgba(100, 116, 139, 0.1)'}} contentStyle={{backgroundColor: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(5px)', borderRadius: '0.5rem', border: '1px solid rgba(0,0,0,0.1)'}} />
                                        <Bar dataKey="avgLatency" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="flex items-center justify-center h-full text-gray-500">No latency data available for the last 24 hours.</div>
                            )}
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                             <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">System Status</h3>
                             <ul className="space-y-4">
                                {Object.entries(systemStatus).map(([key, value]) => (
                                    <li key={key} className="flex justify-between items-center">
                                        <span className="text-gray-600 dark:text-gray-300 capitalize">{key.replace(/_/g, ' ')}</span>
                                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${value.status === 'operational' ? 'bg-green-100 text-green-800 dark:bg-green-800/30 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-800/30 dark:text-red-300'}`}>
                                            {value.status}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    <div>
                        {session && <RecentNotifications 
                            notifications={notifications}
                            onUpdateNotification={onUpdateNotification}
                            onAddComment={onAddComment}
                            session={session}
                            topics={topics}
                        />}
                    </div>
                </div>
            </main>
        </>
    );
};
