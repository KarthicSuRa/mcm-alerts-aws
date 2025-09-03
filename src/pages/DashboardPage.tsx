import { Header } from '../components/layout/Header';
import { Notification, SystemStatusData, Session, MonitoredSite, Topic } from '../types';
import { StatCards } from '../components/dashboard/StatCards';
import { RecentNotifications } from '../components/dashboard/RecentNotifications';
import SiteMap from '../components/monitoring/SiteMap';

interface DashboardPageProps {
  notifications: Notification[];
  onNavigate: (page: string) => void;
  onLogout: () => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  openSettings: () => void;
  systemStatus: SystemStatusData;
  session: Session | null;
  sites: MonitoredSite[];
  loadingSites: boolean;
  sitesError: string | null;
  onUpdateNotification: (notificationId: string, updates: any) => Promise<void>;
  onAddComment: (notificationId: string, text: string) => Promise<void>;
  topics: Topic[];
  onClearLogs: () => Promise<void>;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ 
    notifications, 
    onNavigate, 
    onLogout, 
    isSidebarOpen, 
    setIsSidebarOpen, 
    openSettings, 
    systemStatus, 
    session,
    sites,
    loadingSites,
    sitesError,
    onUpdateNotification,
    onAddComment,
    topics,
    onClearLogs,
}) => {
    
    return (
        <>
            <Header 
                onNavigate={onNavigate} 
                onLogout={onLogout} 
                notifications={notifications} 
                isSidebarOpen={isSidebarOpen} 
                setIsSidebarOpen={setIsSidebarOpen} 
                openSettings={openSettings} 
                systemStatus={systemStatus} 
                session={session} 
            />
            <main className="flex-1 overflow-y-auto bg-background lg:ml-72">
                <div className="max-w-screen-2xl mx-auto p-4 sm:p-6 lg:p-8">
                    <h1 className="text-4xl font-bold mb-6">Dashboard</h1>
                    <StatCards notifications={notifications} sites={sites} />
                    
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
                        <div className="lg:col-span-2">
                            <RecentNotifications 
                                notifications={notifications.slice(0, 10)} 
                                onUpdateNotification={onUpdateNotification}
                                onAddComment={onAddComment}
                                onClearLogs={onClearLogs}
                                topics={topics}
                                session={session}
                            />
                        </div>
                        <div className="flex flex-col gap-8">
                             <div className="h-[300px] lg:h-auto lg:flex-grow">
                                <SiteMap sites={sites} loading={loadingSites} error={sitesError} />
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </>
    );
};