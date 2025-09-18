import React, { Dispatch, SetStateAction } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Header } from '../../components/layout/Header';
import { SiteHeader } from '../../components/monitoring/SiteHeader';
import { CurrentStatusCard } from '../../components/monitoring/CurrentStatusCard';
import { UptimeSparkline } from '../../components/monitoring/UptimeSparkline';
import { ResponseTimeChart } from '../../components/monitoring/ResponseTimeChart';
import { UptimeCard } from '../../components/monitoring/UptimeCard';
import { LatestIncidents } from '../../components/monitoring/LatestIncidents';
import { SiteInfoSidebar } from '../../components/monitoring/SiteInfoSidebar';
import { useMonitoringData } from '../../hooks/useMonitoringData';
import { Text, Grid } from '@tremor/react';
import { type Notification, type SystemStatusData, type Session, type PingLog } from '../../types';

interface SiteDetailPageProps {
  session: Session;
  onLogout: () => Promise<void>;
  openSettings: () => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: Dispatch<SetStateAction<boolean>>;
  notifications: Notification[];
  systemStatus: SystemStatusData;
  onNavigate: (page: string) => void;
}

const calculateUptime = (pings: PingLog[] | undefined) => {
    if (!pings || pings.length === 0) {
        return { percentage: 100, incidents: 0 };
    }
    const upPings = pings.filter(p => p.is_up).length;
    const totalPings = pings.length;
    const incidents = pings.reduce((acc, ping, index) => {
        if (index > 0 && !ping.is_up && pings[index - 1].is_up) {
            return acc + 1;
        }
        return acc;
    }, !pings[0].is_up ? 1 : 0);

    return {
        percentage: parseFloat(((upPings / totalPings) * 100).toFixed(2)),
        incidents: incidents
    };
}

export const SiteDetailPage: React.FC<SiteDetailPageProps> = ({
  session,
  onLogout,
  openSettings,
  isSidebarOpen,
  setIsSidebarOpen,
  notifications,
  systemStatus,
  onNavigate,
}) => {
  const { id } = useParams<{ id: string }>();
  const { site, loading, error } = useMonitoringData(id || '');

  const renderContent = () => {
    if (loading) {
      return <div className="flex justify-center items-center h-64"><Text>Loading site details...</Text></div>;
    }
  
    if (error) {
      return <div className="flex justify-center items-center h-64"><Text className="text-red-500">Error: {error}</Text></div>;
    }
  
    if (!site) {
      return <div className="flex justify-center items-center h-64"><Text>Site data could not be loaded.</Text></div>;
    }

    const uptime24h = calculateUptime(site.ping_logs?.slice(0, 288));
    const uptime7d = calculateUptime(site.ping_logs?.slice(0, 2016));
    const uptime30d = calculateUptime(site.ping_logs);

    return (
        <div className="space-y-6">
            <SiteHeader site={site} />
            
            <Grid numItemsLg={3} className="gap-6">
                {/* Main Content Column */}
                <div className="lg:col-span-2 space-y-6">
                    <Grid numItemsMd={2} className="gap-6">
                        <CurrentStatusCard site={site} />
                        <UptimeSparkline pings={site.ping_logs?.slice(0, 60) || []} />
                    </Grid>

                    <ResponseTimeChart pings={site.ping_logs || []} />

                    <Grid numItemsMd={3} className="gap-6">
                        <UptimeCard label="Last 24 hours" stats={uptime24h} />
                        <UptimeCard label="Last 7 days" stats={uptime7d} />
                        <UptimeCard label="Last 30 days" stats={uptime30d} />
                    </Grid>
                </div>

                {/* Right Sidebar */}
                <div className="lg:col-span-1 space-y-6">
                    <SiteInfoSidebar site={site} />
                    <LatestIncidents incidents={site.incidents || []} />
                </div>
            </Grid>
        </div>
    );
  }

  return (
    <>
      <Header
        session={session}
        onLogout={onLogout}
        openSettings={openSettings}
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        notifications={notifications}
        systemStatus={systemStatus}
        title={site?.name || 'Site Details'}
        onNavigate={onNavigate}
      />
      <main className="flex-1 overflow-y-auto bg-background md:ml-72">
        <div className="max-w-screen-2xl mx-auto p-4 sm:p-6 lg:p-8">
            {renderContent()}
        </div>
      </main>
    </>
  );
};
