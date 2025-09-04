import React, { useState, useMemo } from 'react';
import { Header } from '../components/layout/Header';
import { Icon } from '../components/ui/Icon';
import { Notification, Session, SystemStatusData, Topic } from '../types';
import { 
    differenceInMinutes, 
    subMonths,
    format, 
    isValid, 
    startOfMonth, 
    endOfMonth, 
    eachDayOfInterval
} from 'date-fns';
import {
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';

interface AnalyticsPageProps {
  notifications: Notification[];
  session: Session | null;
  onNavigate: (page: string) => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  onLogout: () => void;
  openSettings: () => void;
  systemStatus: SystemStatusData;
  topics: Topic[];
}

// --- Helper Functions ---
const calculateAverageTime = (items: number[]) => {
  if (items.length === 0) return 0;
  return items.reduce((sum, item) => sum + item, 0) / items.length;
};

const formatMinutes = (minutes: number) => {
  if (minutes < 1) return '< 1 min';
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.round(minutes % 60);
  return `${hours}h ${remainingMinutes}m`;
};

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#ff4d4d'];

const CustomTooltip = ({ active, payload, label, month }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="p-2 bg-slate-900/80 text-white rounded-md border border-slate-700 backdrop-blur-sm">
          <p className="label">{`${month} ${label}`}</p>
          <p className="intro">{`Alerts: ${payload[0].value}`}</p>
        </div>
      );
    }
    return null;
  };


export const AnalyticsPage: React.FC<AnalyticsPageProps> = ({ 
    notifications, 
    session, 
    onNavigate, 
    isSidebarOpen, 
    setIsSidebarOpen,
    onLogout,
    openSettings,
    systemStatus,
    topics
}) => {
    const [selectedMonth, setSelectedMonth] = useState(startOfMonth(new Date()));

    const monthOptions = useMemo(() => {
        return Array.from({ length: 6 }, (_, i) => startOfMonth(subMonths(new Date(), i)));
    }, []);

    const filteredData = useMemo(() => {
        const startDate = startOfMonth(selectedMonth);
        const endDate = endOfMonth(selectedMonth);

        const filteredNotifications = notifications.filter(n => {
            const nDate = new Date(n.timestamp);
            return isValid(nDate) && nDate >= startDate && nDate <= endDate;
        });

        const acknowledgedTimes = filteredNotifications
            .filter(n => n.acknowledgedAt && isValid(new Date(n.acknowledgedAt)))
            .map(n => differenceInMinutes(new Date(n.acknowledgedAt!), new Date(n.timestamp)));

        const resolvedTimes = filteredNotifications
            .filter(n => n.status === 'resolved' && n.resolvedAt && isValid(new Date(n.resolvedAt)))
            .map(n => differenceInMinutes(new Date(n.resolvedAt!), new Date(n.timestamp)));

        const mtta = calculateAverageTime(acknowledgedTimes);
        const mttr = calculateAverageTime(resolvedTimes);
        const totalAlerts = filteredNotifications.length;

        const topicCounts = filteredNotifications.reduce((acc, n) => {
            const topicId = n.topic_id || 'general';
            acc[topicId] = (acc[topicId] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const pieData = Object.entries(topicCounts).map(([topicId, count]) => {
            const topic = topics.find(t => t.id === topicId);
            return {
                name: topic ? topic.name : 'General',
                value: count
            }
        });

        const daysInMonth = eachDayOfInterval({ start: startDate, end: endDate });
        const dailyAlerts = daysInMonth.map(day => ({
            name: format(day, 'dd'), // Use day number for X-axis
            alerts: 0
        }));

        filteredNotifications.forEach(n => {
            const day = format(new Date(n.timestamp), 'dd');
            const entry = dailyAlerts.find(d => d.name === day);
            if (entry) entry.alerts++;
        });

        return { mtta, mttr, totalAlerts, pieData, dailyAlerts };
    }, [notifications, topics, selectedMonth]);

    const { mtta, mttr, totalAlerts, pieData, dailyAlerts } = filteredData;

    const handleGenerateReport = () => {
        const monthName = format(selectedMonth, 'MMMM yyyy');
        const reportHtml = `
            <html>
            <head>
                <title>Monitoring Report</title>
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; margin: 2rem; background-color: #f8fafc; color: #1e293b; }
                    h1, h2 { color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; }
                    .metric-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; margin-bottom: 2rem; }
                    .metric { background-color: #ffffff; border: 1px solid #e2e8f0; padding: 1.5rem; text-align: center; border-radius: 0.75rem; box-shadow: 0 1px 3px rgba(0,0,0,0.02), 0 1px 2px rgba(0,0,0,0.04); }
                    .metric-label { font-size: 0.9rem; color: #64748b; margin-bottom: 0.5rem; }
                    .metric-value { font-size: 2.25em; font-weight: 700; color: #0f172a; }
                </style>
            </head>
            <body>
                <h1>Monitoring Report - ${monthName}</h1>
                <p>Generated for ${session?.user?.email} on: ${new Date().toLocaleDateString()}</p>
                
                <div class="metric-grid">
                    <div class="metric">
                        <div class="metric-label">Total Alerts</div>
                        <div class="metric-value">${totalAlerts}</div>
                    </div>
                    <div class="metric">
                        <div class="metric-label">Mean Time to Acknowledge</div>
                        <div class="metric-value">${formatMinutes(mtta)}</div>
                    </div>
                    <div class="metric">
                        <div class="metric-label">Mean Time to Resolution</div>
                        <div class="metric-value">${formatMinutes(mttr)}</div>
                    </div>
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
        <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900 lg:ml-72">
            <div className="max-w-screen-xl mx-auto p-4 sm:p-6 lg:p-8">
                <div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800 dark:text-white">Analytics & Reporting</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            System and team performance insights for {format(selectedMonth, 'MMMM yyyy')}.
                        </p>
                    </div>
                    <button onClick={handleGenerateReport} className="mt-4 sm:mt-0 flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors">
                        <Icon name="file-text" className="w-4 h-4" />
                        Generate Report
                    </button>
                </div>

                {/* Key Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <StatCard icon="bell" title="Total Alerts" value={totalAlerts.toString()} />
                    <StatCard icon="check-circle" title="Mean Time to Acknowledge" value={formatMinutes(mtta)} />
                    <StatCard icon="shield-check" title="Mean Time to Resolution" value={formatMinutes(mttr)} />
                </div>

                {/* Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                    <div className="lg:col-span-3 bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md">
                        <div className="flex flex-wrap justify-between items-center mb-4 gap-4">
                            <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Alerts in {format(selectedMonth, 'MMMM')}</h3>
                            <div className="flex items-center gap-2 flex-wrap">
                                {monthOptions.map(month => (
                                    <button
                                        key={month.getTime()}
                                        onClick={() => setSelectedMonth(month)}
                                        className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                                            selectedMonth.getTime() === month.getTime()
                                                ? 'bg-indigo-600 text-white shadow-sm'
                                                : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
                                        }`}>
                                        {format(month, 'MMMM')}
                                    </button>
                                ))}
                            </div>
                        </div>
                         <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={dailyAlerts} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} padding={{ left: 10, right: 10 }}/>
                                <YAxis fontSize={12} tickLine={false} axisLine={false} allowDecimals={false}/>
                                <Tooltip content={<CustomTooltip month={format(selectedMonth, 'MMM')} />} cursor={{ fill: 'rgba(100, 116, 139, 0.1)' }} />
                                <Bar dataKey="alerts" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                            </BarChart>
                         </ResponsiveContainer>
                    </div>
                     <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md">
                         <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">Alerts by Topic</h3>
                         {pieData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={300}>
                                <PieChart>
                                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                                        {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                    </Pie>
                                    <Tooltip formatter={(value, name) => [value, name]} />
                                    <Legend iconSize={10} />
                                </PieChart>
                            </ResponsiveContainer>
                         ) : (
                            <div className="flex items-center justify-center h-full text-slate-400">No data available for this period.</div>
                         )}
                    </div>
                </div>
            </div>
        </main>
    </>
  );
};

// StatCard component for a consistent look
const StatCard: React.FC<{icon: string, title: string, value: string}> = ({ icon, title, value }) => (
    <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-md flex items-center gap-4">
        <div className="bg-indigo-100 dark:bg-indigo-500/20 p-3 rounded-full">
            <Icon name={icon} className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</h3>
            <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
        </div>
    </div>
);
