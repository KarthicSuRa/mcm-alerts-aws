import React, { useState, useEffect, useMemo } from 'react';
import L from 'leaflet';
import { Header } from '../components/layout/Header';
import { Notification, SystemStatusData, Session, MonitoredSite, Topic, PingLog } from '../types';
import { StatCards } from '../components/dashboard/StatCards';
import { RecentNotifications } from '../components/dashboard/RecentNotifications';
import { ActivityFeed } from '../components/dashboard/ActivityFeed';
import ChartsWidget from '../components/dashboard/ChartsWidget';
import SiteMap from '../components/monitoring/SiteMap';
import { supabase } from '../lib/supabaseClient';

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

const REGIONS: Record<string, { center: L.LatLngExpression; zoom: number; filter: (site: MonitoredSite) => boolean; }> = {
    Global: {
        center: [20, 0],
        zoom: 1.8,
        filter: (site) => !!site.latitude && !!site.longitude,
    },
    Europe: {
        center: [50.1109, 10.1348],
        zoom: 3.5,
        filter: (site) => !!site.latitude && !!site.longitude && site.latitude > 35 && site.latitude < 70 && site.longitude > -10 && site.longitude < 40,
    },
    'North America': {
        center: [40, -100],
        zoom: 2.8,
        filter: (site) => !!site.latitude && !!site.longitude && site.latitude > 25 && site.latitude < 70 && site.longitude > -140 && site.longitude < -50,
    },
    'Asia Pacific': {
        center: [0, 120],
        zoom: 2.8,
        filter: (site) => !!site.latitude && !!site.longitude && site.latitude > -50 && site.latitude < 70 && site.longitude > 60 && site.longitude < 180,
    },
};

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
    const [sitesWithStatus, setSitesWithStatus] = useState<MonitoredSite[]>([]);
    const [activeTab, setActiveTab] = useState('Global');

    useEffect(() => {
        const fetchAndProcessSites = async () => {
            if (loadingSites || sitesError || !sites || sites.length === 0) {
                if (sitesError) setSitesWithStatus([]);
                return;
            }

            try {
                const { data: logsData, error: logsError } = await supabase
                    .from('ping_logs')
                    .select('*')
                    .order('checked_at', { ascending: false });

                if (logsError) {
                    console.error("Failed to fetch ping logs for dashboard map:", logsError);
                }

                const latestPings = new Map<string, PingLog>();
                if (logsData) {
                    for (const log of logsData) {
                        if (!latestPings.has(log.site_id)) {
                            latestPings.set(log.site_id, log as PingLog);
                        }
                    }
                }

                const formattedSites = sites.map(site => {
                    const latestPing = latestPings.get(site.id);
                    return {
                        ...site,
                        status: latestPing ? (latestPing.is_up ? 'online' : 'offline') : 'unknown',
                        latest_ping: latestPing || null,
                    };
                });

                setSitesWithStatus(formattedSites as MonitoredSite[]);
            } catch (e) {
                console.error("Error processing site status for dashboard:", e);
                setSitesWithStatus(sites); 
            }
        };

        fetchAndProcessSites();
    }, [sites, loadingSites, sitesError]);
    
    const { filteredSites, mapCenter, mapZoom } = useMemo(() => {
        const region = REGIONS[activeTab] || REGIONS.Global;
        const filtered = sitesWithStatus.filter(region.filter);
        return {
            filteredSites: filtered,
            mapCenter: region.center,
            mapZoom: region.zoom,
        };
    }, [sitesWithStatus, activeTab]);

    const siteCount = (regionName: string) => {
        const region = REGIONS[regionName];
        if (!region) return sitesWithStatus.filter(REGIONS.Global.filter).length;
        return sitesWithStatus.filter(region.filter).length;
    };

    const regions = Object.keys(REGIONS);

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
            <main className="flex-1 overflow-y-auto bg-background md:ml-72">
                <div className="max-w-screen-2xl mx-auto p-4 sm:p-6 lg:p-8">
                    <h1 className="text-2xl sm:text-3xl font-bold">My Dashboard</h1>
                    <p className="text-muted-foreground text-sm sm:text-base">Welcome back, {session?.user?.email}. Here's an overview of your system.</p>
                    
                    <div className="mt-6">
                        <StatCards notifications={notifications} sites={sitesWithStatus} />
                    </div>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 mt-8">
                        <div className="lg:col-span-3 flex flex-col gap-8 order-2 lg:order-1">
                            <RecentNotifications 
                                notifications={notifications.slice(0, 10)} 
                                onUpdateNotification={onUpdateNotification}
                                onAddComment={onAddComment}
                                onClearLogs={onClearLogs}
                                topics={topics}
                                session={session}
                            />
                            <ActivityFeed notifications={notifications} />
                        </div>
                        <div className="lg:col-span-2 flex flex-col gap-8 order-1 lg:order-2">
                            <div className="bg-card border rounded-lg p-4">
                                <h2 className="text-xl font-semibold mb-2 px-2">Site Availability</h2>
                                <div className="border-b border-border mb-4">
                                    <nav className="-mb-px flex space-x-6 px-2">
                                        {regions.map(region => (
                                            <button
                                                key={region}
                                                onClick={() => setActiveTab(region)}
                                                className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${
                                                    activeTab === region
                                                    ? 'border-primary text-primary'
                                                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                                                }`}>
                                                {region} <span className="text-xs text-muted-foreground">({siteCount(region)})</span>
                                            </button>
                                        ))}
                                    </nav>
                                </div>
                                <div className="h-[300px] w-full">
                                   {loadingSites ? (
                                       <div className="flex items-center justify-center h-full"><p>Loading map...</p></div>
                                   ) : (
                                       <SiteMap 
                                           sites={filteredSites} 
                                           loading={loadingSites} 
                                           error={sitesError} 
                                           center={mapCenter}
                                           zoom={mapZoom}
                                       />
                                   )}
                                </div>
                            </div>
                             <ChartsWidget notifications={notifications} />
                        </div>
                    </div>
                </div>
            </main>
        </>
    );
};
