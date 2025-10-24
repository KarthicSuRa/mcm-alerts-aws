import React, { useState, useEffect } from 'react';
import { Header } from '../components/layout/Header';
import { Icon } from '../components/ui/Icon';
import { Notification, SystemStatusData, Session, AuditLog } from '../types';
import { awsClient } from '../lib/awsClient';
import { format } from 'date-fns';

interface AuditLogPageProps {
  onNavigate: (page: string) => void;
  onLogout: () => Promise<void>;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  notifications: Notification[];
  openSettings: () => void;
  systemStatus: SystemStatusData;
  session: Session;
}

export const AuditLogPage: React.FC<AuditLogPageProps> = ({ onNavigate, onLogout, isSidebarOpen, setIsSidebarOpen, notifications, openSettings, systemStatus, session }) => {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAuditLogs = async () => {
      try {
        const data = await awsClient.get('/audit-logs');
        setAuditLogs(data || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAuditLogs();
  }, []);

  return (
    <>
      <Header onLogout={onLogout} notifications={notifications} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} openSettings={openSettings} systemStatus={systemStatus} session={session} onNavigate={onNavigate} />
      <main className="flex-1 overflow-y-auto bg-background md:ml-72">
        <div className="max-w-screen-2xl mx-auto p-4 sm:p-6 lg:p-8">
          <div className="flex items-center mb-8">
            <button onClick={() => onNavigate('dashboard')} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 mr-4">
              <Icon name="arrow-left" className="h-5 w-5 text-gray-700 dark:text-gray-300" />
            </button>
            <div>
              <h1 className="text-3xl font-bold">Audit Logs</h1>
              <p className="text-muted-foreground mt-1">Track user activities and system events.</p>
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border">
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">Recent Activities</h2>
              {loading ? (
                <p>Loading audit logs...</p>
              ) : error ? (
                <p className="text-red-500">{error}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-border">
                    <thead className="bg-muted/50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">User</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Action</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Timestamp</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {auditLogs.map(log => (
                        <tr key={log.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">{log.user_email}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{log.action}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{format(new Date(log.timestamp), 'PPP p')}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{log.details}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  );
};
