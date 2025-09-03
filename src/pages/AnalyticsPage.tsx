import React from 'react';
import { Header } from '../components/layout/Header';
import { Icon } from '../components/ui/Icon';
import { Notification, Session, SystemStatusData } from '../types';
import { formatDistanceToNow, differenceInMinutes } from 'date-fns';

interface AnalyticsPageProps {
  notifications: Notification[];
  session: Session | null;
  onNavigate: (page: string) => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  onLogout: () => void;
  openSettings: () => void;
  systemStatus: SystemStatusData;
}

// Helper to calculate average time
const calculateAverageTime = (items: number[]) => {
  if (items.length === 0) return 0;
  const total = items.reduce((sum, item) => sum + item, 0);
  return total / items.length;
};

// Helper to format minutes into a readable string
const formatMinutes = (minutes: number) => {
    if (minutes < 1) return '< 1 minute';
    if (minutes < 60) return `${Math.round(minutes)} minutes`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = Math.round(minutes % 60);
    return `${hours}h ${remainingMinutes}m`;
}

export const AnalyticsPage: React.FC<AnalyticsPageProps> = ({ 
    notifications, 
    session, 
    onNavigate, 
    isSidebarOpen, 
    setIsSidebarOpen,
    onLogout,
    openSettings,
    systemStatus
}) => {

    // --- Data Processing ---
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentNotifications = notifications.filter(n => new Date(n.timestamp) > thirtyDaysAgo);

    const acknowledgedTimes = recentNotifications
        .filter(n => n.acknowledgedAt)
        .map(n => differenceInMinutes(new Date(n.acknowledgedAt!), new Date(n.timestamp)));

    const resolvedTimes = recentNotifications
        .filter(n => n.status === 'resolved' && n.resolvedAt)
        .map(n => differenceInMinutes(new Date(n.resolvedAt!), new Date(n.timestamp)));

    const mtta = calculateAverageTime(acknowledgedTimes);
    const mttr = calculateAverageTime(resolvedTimes);
    const totalAlerts = recentNotifications.length;

    const handleGenerateReport = () => {
        const reportHtml = `
            <html>
                <head>
                    <title>Monthly Monitoring Report</title>
                    <style>
                        body { font-family: sans-serif; margin: 2rem; }
                        h1 { color: #333; } h2 { color: #555; border-bottom: 1px solid #eee; padding-bottom: 10px; }
                        .metric { background-color: #f9f9f9; border: 1px solid #ddd; padding: 15px; margin-bottom: 1rem; border-radius: 8px; }
                        .metric-value { font-size: 2em; font-weight: bold; }
                    </style>
                </head>
                <body>
                    <h1>Monitoring Report</h1>
                    <p>Generated on: ${new Date().toLocaleDateString()}</p>
                    
                    <h2>Key Metrics (Last 30 Days)</h2>
                    <div class="metric">
                        <div>Total Alerts</div>
                        <div class="metric-value">${totalAlerts}</div>
                    </div>
                    <div class="metric">
                        <div>Mean Time to Acknowledge (MTTA)</div>
                        <div class="metric-value">${formatMinutes(mtta)}</div>
                    </div>
                    <div class="metric">
                        <div>Mean Time to Resolution (MTTR)</div>
                        <div class="metric-value">${formatMinutes(mttr)}</div>
                    </div>
                </body>
            </html>
        `;
        const blob = new Blob([reportHtml], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
    };

    return (
    <>
        <Header onNavigate={onNavigate} onLogout={onLogout} notifications={notifications} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} openSettings={openSettings} systemStatus={systemStatus} session={session} />
        <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900 lg:ml-72">
            <div className="max-w-screen-xl mx-auto p-4 sm:p-6 lg:p-8">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Analytics & Reporting</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Insights into system performance and team response over the last 30 days.</p>
                    </div>
                    <button onClick={handleGenerateReport} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
                        <Icon name="file-text" className="w-4 h-4" />
                        Generate Report
                    </button>
                </div>

                {/* Key Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
                        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Alerts</h3>
                        <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">{totalAlerts}</p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
                        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Mean Time to Acknowledge</h3>
                        <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">{formatMinutes(mtta)}</p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
                        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Mean Time to Resolution</h3>
                        <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">{formatMinutes(mttr)}</p>
                    </div>
                </div>

                {/* Charts - Placeholder */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm min-h-[20rem]">
                         <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Alerts by Topic</h3>
                         <div className="flex items-center justify-center h-full text-gray-400">Chart placeholder</div>
                    </div>
                     <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm min-h-[20rem]">
                         <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Alerts Over Time</h3>
                         <div className="flex items-center justify-center h-full text-gray-400">Chart placeholder</div>
                    </div>
                </div>

            </div>
        </main>
    </>
  );
};
