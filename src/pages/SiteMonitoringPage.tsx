import React, { useState, useEffect, useCallback } from 'react';
import { Header } from '../components/layout/Header';
import SiteList from '../components/monitoring/SiteList';
import SiteMap from '../components/monitoring/SiteMap';
import { AddSiteModal } from '../components/monitoring/AddSiteModal';
import { Button } from '../components/ui/Button';
import { type Notification, type Topic, type SystemStatusData, type Session, type MonitoredSite } from '../types';
import { supabase } from '../lib/supabaseClient';

interface SiteMonitoringPageProps {
  notifications: Notification[];
  topics: Topic[];
  onNavigate: (page: string) => void;
  onLogout: () => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  openSettings: () => void;
  systemStatus: SystemStatusData;
  session: Session;
}

export const SiteMonitoringPage: React.FC<SiteMonitoringPageProps> = ({
  notifications,
  onNavigate,
  onLogout,
  isSidebarOpen,
  setIsSidebarOpen,
  openSettings,
  systemStatus,
  session,
}) => {
  const [sites, setSites] = useState<MonitoredSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddSiteModalOpen, setIsAddSiteModalOpen] = useState(false);

  const fetchSiteStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: functionError } = await supabase.functions.invoke('site-monitoring');

      if (functionError) {
        if (functionError.message.includes("not found")) {
            throw new Error("The 'site-monitoring' edge function could not be found. Please ensure it is deployed correctly.");
        }
        throw functionError;
      }

      if (!data || !data.sites) {
        console.warn("Edge function returned no site data.");
        setSites([]);
      } else {
        setSites(data.sites as MonitoredSite[]);
      }

    } catch (e: any) {
      setError(`Failed to fetch site status: ${e.message}`);
      console.error("Error fetching initial site status:", e);
      setSites([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSiteStatus();

    const channel = supabase
      .channel('public:ping_logs')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ping_logs' },
        (payload) => {
          const newLog = payload.new as { site_id: string; is_up: boolean; created_at: string };
          
          setSites(currentSites =>
            currentSites.map(site =>
              site.id === newLog.site_id
                ? { ...site, status: newLog.is_up ? 'online' : 'offline', last_checked: newLog.created_at }
                : site
            )
          );
        }
      )
      .subscribe((status, err) => {
          if (status === 'SUBSCRIBED') {
            console.log('Realtime channel for ping_logs is active.');
          }
          if (err) {
            console.error('Realtime channel error:', err);
            setError('Realtime connection to site status failed. Please refresh the page.');
          }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchSiteStatus]);

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
      <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900 lg:ml-72">
        <div className="max-w-screen-2xl mx-auto p-4 sm:p-6 lg:p-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Site Monitoring</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Track the real-time status and performance of your websites and services.
              </p>
            </div>
            <Button onClick={() => setIsAddSiteModalOpen(true)}>Add New Site</Button>
          </div>
          
          <div className="h-[600px] rounded-lg overflow-hidden mb-6 shadow-sm">
            <SiteMap sites={sites} loading={loading} error={error} />
          </div>
          
          <SiteList sites={sites} loading={loading} error={error} refetch={fetchSiteStatus} />

        </div>
      </main>
      <AddSiteModal 
        isOpen={isAddSiteModalOpen} 
        onClose={() => setIsAddSiteModalOpen(false)} 
        onSiteAdded={fetchSiteStatus} 
      />
    </>
  );
};