import React, { useMemo, useState } from 'react';
import { Header } from '../components/layout/Header';
import { Notification, AuditLog, SystemStatusData, Session, Comment } from '../types';
import { Icon } from '../components/ui/Icon';
import { SEVERITY_INFO } from '../constants';

interface AuditLogsPageProps {
  notifications: Notification[];
  onNavigate: (page: string) => void;
  onLogout: () => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  openSettings: () => void;
  systemStatus: SystemStatusData;
  session: Session;
}

function generateAuditLogs(notifications: Notification[]): AuditLog[] {
    const logs: AuditLog[] = [];

    notifications.forEach(n => {
        logs.push({
            id: `log-create-${n.id}`,
            timestamp: n.created_at,
            user: 'System',
            action: 'Created',
            details: `Alert "${n.title}" created with ${n.severity} priority.`,
            notificationId: n.id,
        });
        
        n.comments.forEach((c: Comment) => {
             const action = c.text.startsWith('Status changed to') ? c.text.split(' ')[2].replace('.','') : 'Commented';
             const stylingAction = action === 'Acknowledged' || action === 'Resolved' || action === 'Re-opened' ? action : 'Commented';
             logs.push({
                id: `log-comment-${c.id}`,
                timestamp: c.created_at,
                user: c.user_email || 'Unknown User',
                action: stylingAction,
                details: stylingAction === 'Commented' ? `Commented: "${c.text}"` : c.text,
                notificationId: n.id,
            });
        });
    });
    return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

const getActionStyling = (action: string): { icon: string; color: string } => {
    switch(action) {
        case 'Created': return { icon: 'plus', color: 'text-blue-500' };
        case 'Acknowledged': return { icon: 'check', color: 'text-success' };
        case 'Resolved': return { icon: 'shield', color: 'text-primary' };
        case 'Re-opened': return { icon: 'refresh-cw', color: 'text-purple-500' };
        case 'Commented': return { icon: 'messageSquare', color: 'text-muted-foreground' };
        default: return { icon: 'logs', color: 'text-muted-foreground' };
    }
}

export const AuditLogsPage: React.FC<AuditLogsPageProps> = ({ notifications, onNavigate, onLogout, isSidebarOpen, setIsSidebarOpen, openSettings, systemStatus, session }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [timeFilter, setTimeFilter] = useState('all');

    const filteredLogs = useMemo(() => {
        let logs = generateAuditLogs(notifications);

        if (timeFilter !== 'all') {
            const now = new Date();
            const filterDate = new Date();
            if (timeFilter === '24h') {
                filterDate.setHours(now.getHours() - 24);
            } else if (timeFilter === '7d') {
                filterDate.setDate(now.getDate() - 7);
            }
            logs = logs.filter(log => new Date(log.timestamp) > filterDate);
        }

        if (searchTerm) {
            const lowercasedFilter = searchTerm.toLowerCase();
            logs = logs.filter(log =>
                log.user.toLowerCase().includes(lowercasedFilter) ||
                log.action.toLowerCase().includes(lowercasedFilter) ||
                log.details.toLowerCase().includes(lowercasedFilter)
            );
        }

        return logs;
    }, [notifications, searchTerm, timeFilter]);

    const getNotificationById = (id: string) => notifications.find(n => n.id === id);

    return (
    <>
        <Header onNavigate={onNavigate} onLogout={onLogout} notifications={notifications} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} openSettings={openSettings} systemStatus={systemStatus} session={session} />
        <main className="flex-1 overflow-y-auto bg-background lg:ml-72">
            <div className="max-w-screen-2xl mx-auto p-4 sm:p-6 lg:p-8">
                <h1 className="text-4xl font-bold mb-1">Audit Logs</h1>
                <p className="text-muted-foreground mb-6">A detailed history of all notification events and user actions.</p>
                
                <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                    <div className="p-4 flex flex-col sm:flex-row gap-4 border-b border-border">
                        <div className="relative flex-grow">
                            <Icon name="search" className="w-5 h-5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                placeholder="Search logs..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 text-sm rounded-md border-border bg-transparent shadow-sm focus:border-ring focus:ring-ring"
                            />
                        </div>
                        <select
                            value={timeFilter}
                            onChange={e => setTimeFilter(e.target.value)}
                            className="text-sm rounded-md border-border bg-transparent shadow-sm focus:border-ring focus:ring-ring"
                        >
                            <option value="all">All Time</option>
                            <option value="24h">Last 24 hours</option>
                            <option value="7d">Last 7 days</option>
                        </select>
                    </div>

                    {/* Desktop Table View */}
                    <div className="overflow-x-auto hidden md:block">
                        <table className="w-full text-sm text-left text-muted-foreground">
                            <thead className="text-xs text-muted-foreground uppercase bg-secondary/50">
                                <tr>
                                    <th scope="col" className="px-6 py-3">Timestamp</th>
                                    <th scope="col" className="px-6 py-3">User</th>
                                    <th scope="col" className="px-6 py-3">Action</th>
                                    <th scope="col" className="px-6 py-3">Details</th>
                                    <th scope="col" className="px-6 py-3">Related Alert</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredLogs.map(log => {
                                    const notification = getNotificationById(log.notificationId);
                                    const { icon, color } = getActionStyling(log.action);
                                    return (
                                    <tr key={log.id} className="bg-card border-b border-border hover:bg-accent">
                                        <td className="px-6 py-4 whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
                                        <td className="px-6 py-4 font-medium text-foreground">{log.user}</td>
                                        <td className="px-6 py-4">
                                            <span className="flex items-center gap-2">
                                                <Icon name={icon} className={`w-4 h-4 ${color}`} />
                                                {log.action}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">{log.details}</td>
                                        <td className="px-6 py-4">
                                            {notification ? (
                                                <span className={`px-2 py-0.5 text-xs font-semibold rounded-full bg-muted`}>
                                                    {notification.title}
                                                </span>
                                            ) : 'N/A'}
                                        </td>
                                    </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="md:hidden">
                        {filteredLogs.map(log => {
                            const notification = getNotificationById(log.notificationId);
                            const { icon, color } = getActionStyling(log.action);
                            return (
                                <div key={log.id} className="p-4 border-b border-border">
                                    <div className="flex justify-between items-start">
                                        <p className="font-semibold text-foreground">{log.details}</p>
                                        <span className="flex items-center gap-2 text-sm ml-2 flex-shrink-0">
                                            <Icon name={icon} className={`w-4 h-4 ${color}`} />
                                            {log.action}
                                        </span>
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-2 space-y-1">
                                        <p><strong>User:</strong> {log.user}</p>
                                        <p><strong>Time:</strong> {new Date(log.timestamp).toLocaleString()}</p>
                                        {notification && (
                                            <p><strong>Alert:</strong> <span className={`px-1.5 py-0.5 rounded bg-muted`}>{notification.title}</span></p>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {filteredLogs.length === 0 && (
                        <div className="text-center py-16 text-muted-foreground">
                            <p>No audit logs found.</p>
                            <p className="text-sm mt-1">Try adjusting your search or filter.</p>
                        </div>
                    )}
                </div>
            </div>
        </main>
    </>
  );
};
