import React from 'react';
import { Header } from '../components/layout/Header';
import { Notification, Topic, SystemStatusData, Session, NotificationUpdatePayload } from '../types';
import { StatCards } from '../components/dashboard/StatCards';
import { RecentNotifications } from '../components/dashboard/RecentNotifications';
import { ActivityFeed } from '../components/dashboard/ActivityFeed';
import ErrorBoundary from '../components/ui/ErrorBoundary';
import ChartsWidget from '../components/dashboard/ChartsWidget';
import SiteMap from '../components/monitoring/SiteMap'; // Import the SiteMap component

interface DashboardPageProps {
  notifications: Notification[];
  topics: Topic[];
  onUpdateNotification: (notificationId: string, updates: NotificationUpdatePayload) => Promise<void>;
  onAddComment: (notificationId: string, text: string) => Promise<void>;
  onNavigate: (page: string) => void;
  onLogout: () => void;
  setIsSidebarOpen: (open: boolean) => void;
  openSettings: () => void;
  systemStatus: SystemStatusData;
  session: Session;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
    notifications,
    topics,
    onUpdateNotification,
    onAddComment,
    onNavigate,
    onLogout,
    setIsSidebarOpen,
    openSettings,
    systemStatus,
    session,
}) => {
    return (
        <>
            <Header
                onNavigate={onNavigate}
                onLogout={onLogout}
                notifications={notifications}
                setIsSidebarOpen={setIsSidebarOpen}
                openSettings={openSettings}
                systemStatus={systemStatus}
                session={session}
            />
            <main className="flex-1 overflow-y-auto lg:ml-72 bg-gray-50 dark:bg-gray-900">
                <div className="max-w-screen-2xl mx-auto p-4 sm:p-6 lg:p-8">
                    <div className="mb-6">
                        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">My Dashboard</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Welcome back, {session.user.email}. Here's an overview of your system.
                        </p>
                    </div>

                    <ErrorBoundary>
                        <StatCards notifications={notifications} />
                    </ErrorBoundary>
                    
                    <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 mt-6 items-start">
                        {/* Left Column */}
                        <div className="xl:col-span-3 flex flex-col gap-6">
                            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 md:p-6">
                                <h2 className="text-lg font-semibold mb-4 text-gray-800 dark:text-white">Recent Notifications</h2>
                               <ErrorBoundary>
                                   <RecentNotifications
                                        notifications={notifications}
                                        onUpdateNotification={onUpdateNotification}
                                        onAddComment={onAddComment}
                                        topics={topics}
                                        session={session}
                                    />
                               </ErrorBoundary>
                           </div>
                           <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 md:p-6">
                                <h2 className="text-lg font-semibold mb-4 text-gray-800 dark:text-white">Live Activity Feed</h2>
                                <ErrorBoundary>
                                    <ActivityFeed notifications={notifications} />
                                </ErrorBoundary>
                            </div>
                        </div>

                        {/* Right Column */}
                        <div className="xl:col-span-2 flex flex-col gap-6">
                            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 md:p-6">
                                <h2 className="text-lg font-semibold mb-4 text-gray-800 dark:text-white">Site Availability</h2>
                                <div className="h-64 rounded-lg overflow-hidden">
                                    <ErrorBoundary>
                                        <SiteMap />
                                    </ErrorBoundary>
                                </div>
                            </div>
                            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 md:p-6">
                                <h2 className="text-lg font-semibold mb-4 text-gray-800 dark:text-white">Analytics</h2>
                                <ErrorBoundary>
                                    <ChartsWidget notifications={notifications} />
                                </ErrorBoundary>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </>
    );
};
