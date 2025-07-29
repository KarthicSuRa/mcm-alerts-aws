import React from 'react';
import { Header } from '../components/layout/Header';
import { Notification, Topic, SystemStatusData, Session, NotificationUpdatePayload } from '../types';
import { StatCards } from '../components/dashboard/StatCards';
import { RecentNotifications } from '../components/dashboard/RecentNotifications';
import { ActivityFeed } from '../components/dashboard/ActivityFeed';
import ErrorBoundary from '../components/ui/ErrorBoundary';
import ChartsWidget from '../components/dashboard/ChartsWidget';

interface DashboardPageProps {
  notifications: Notification[];
  topics: Topic[];
  onUpdateNotification: (notificationId: string, updates: NotificationUpdatePayload) => void;
  onAddComment: (notificationId: string, text: string) => void;
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
            <main className="flex-1 overflow-y-auto">
                <div className="max-w-screen-2xl mx-auto p-4 sm:p-6 lg:p-8">
                    <ErrorBoundary>
                        <StatCards notifications={notifications} />
                    </ErrorBoundary>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6 items-stretch">
                        <div className="lg:col-span-2 h-full flex flex-col">
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
                        <div className="lg:col-span-1 flex flex-col gap-6">
                            <ErrorBoundary>
                                <ChartsWidget notifications={notifications} />
                            </ErrorBoundary>
                            <ErrorBoundary>
                                <ActivityFeed notifications={notifications} />
                            </ErrorBoundary>
                        </div>
                    </div>
                </div>
            </main>
        </>
    );
};
