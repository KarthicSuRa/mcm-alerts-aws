'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import L from 'leaflet';
import { Header } from '../components/layout/Header';
import SiteList from '../components/monitoring/SiteList';
import SiteMap from '../components/monitoring/SiteMap';
import { AddSiteModal } from '../components/monitoring/AddSiteModal';
import { Button } from '../components/ui/Button';
import { type Notification, type SystemStatusData, type Session, type MonitoredSite } from '../types';
import { supabase } from '../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';

interface SiteMonitoringPageProps {
  session: Session;
  onLogout: () => void;
  openSettings: () => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  notifications: Notification[];
  systemStatus: SystemStatusData;
}

const REGIONS: Record<string, { center: L.LatLngExpression; zoom: number; filter: (site: MonitoredSite) => boolean; }> = {
    Global: {
        center: [20, 0],
        zoom: 1.5,
        filter: (site) => !!site.latitude && !!site.longitude, // Show all sites on Global map
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

export const SiteMonitoringPage: React.FC<SiteMonitoringPageProps> = ({
  session,
  onLogout,
  openSettings,
  isSidebarOpen,
  setIsSidebarOpen,
  notifications,
  systemStatus,
}) => {
  const [sites, setSites] = useState<MonitoredSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddSiteModalOpen, setIsAddSiteModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('Global');
  const navigate = useNavigate();

  const fetchSiteStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: sitesData, error: sitesError } = await supabase.from('monitored_sites').select('*');
      if (sitesError) throw new Error(`Failed to fetch sites: ${sitesError.message}`);
      if (!sitesData) {
        setSites([]);
        setLoading(false);
        return;
      }

      const { data: logsData, error: logsError } = await supabase.from('ping_logs').select('*').order('checked_at', { ascending: false });
      if (logsError) throw new Error(`Failed to fetch ping logs: ${logsError.message}`);

      const latestPings = new Map();
      if (logsData) {
          for (const log of logsData) {
              if (!latestPings.has(log.site_id)) {
                  latestPings.set(log.site_id, log);
              }
          }
      }

      const formattedSites = sitesData.map(site => ({
        ...site,
        status: latestPings.has(site.id) ? (latestPings.get(site.id).is_up ? 'online' : 'offline') : 'unknown',
        last_checked: latestPings.has(site.id) ? latestPings.get(site.id).checked_at : null,
        latest_ping: latestPings.get(site.id) || null,
      }));

      setSites(formattedSites as MonitoredSite[]);

    } catch (e: any) {
      setError(`Failed to fetch site status: ${e.message}`);
      console.error("Error fetching initial site status:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSiteStatus();
    
    const channel = supabase
      .channel('public:ping_logs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ping_logs' }, (payload) => {
          const newLog = payload.new as any;
          setSites(currentSites =>
            currentSites.map(site =>
              site.id === newLog.site_id ? { ...site, status: newLog.is_up ? 'online' : 'offline', last_checked: newLog.checked_at, latest_ping: newLog } : site
            )
          );
        })
      .subscribe((status, err) => {
          if (status === 'SUBSCRIBED') console.log('Realtime channel for ping_logs is active.');
          else if (err) {
            console.error('Realtime channel error:', err);
            setError('Realtime connection failed. Please refresh.');
          }
      });

    return () => { supabase.removeChannel(channel); };
  }, [fetchSiteStatus]);

  const { filteredSites, mapCenter, mapZoom } = useMemo(() => {
      const region = REGIONS[activeTab] || REGIONS.Global;
      const filtered = sites.filter(region.filter);
      return {
          filteredSites: filtered,
          mapCenter: region.center,
          mapZoom: region.zoom,
      };
  }, [sites, activeTab]);
  
  const siteCount = (regionName: string) => {
    const region = REGIONS[regionName];
    if (!region) return 0;
    if (regionName === 'Global') {
      return sites.filter(REGIONS.Global.filter).length;
    }
    return sites.filter(region.filter).length;
  };

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
        title="Site Monitoring"
        onNavigate={() => {}}
      />
      <main className="flex-1 overflow-y-auto bg-background md:ml-72">
        <div className="max-w-screen-2xl mx-auto p-4 sm:p-6 lg:p-8">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-4">
            <div>
              <Button onClick={() => navigate('/dashboard')} className="mb-4">
                &larr; Back to Dashboard
              </Button>
              <h1 className="text-2xl font-bold">Site Monitoring</h1>
              <p className="text-sm text-muted-foreground mt-1">Track the real-time status and performance of your websites and services.</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setIsAddSiteModalOpen(true)} className="w-full sm:w-auto">Add New Site</Button>
            </div>
          </div>
          
          <div className="bg-card border rounded-lg p-6">
            <div className="border-b border-border mb-4">
                <nav className="-mb-px flex space-x-8 overflow-x-auto">
                    {Object.keys(REGIONS).map(region => (
                        <button
                            key={region}
                            onClick={() => setActiveTab(region)}
                            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm ${
                                activeTab === region
                                ? 'border-primary text-primary'
                                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                            }`}>
                            {region} ({siteCount(region)})
                        </button>
                    ))}
                </nav>
            </div>
            {error ? (
                <div className="min-h-[400px] flex items-center justify-center">
                    <p className="text-red-500">{error}</p>
                </div>
            ) : (
                <>
                    <div className="h-[400px] rounded-lg overflow-hidden mb-6">
                        {loading ? (
                            <div className="flex items-center justify-center h-full"><p>Loading map...</p></div>
                        ) : (
                            <SiteMap 
                                sites={filteredSites} 
                                loading={loading} 
                                error={error} 
                                center={mapCenter} 
                                zoom={mapZoom} 
                            />
                        )}
                    </div>
                    <SiteList 
                        sites={filteredSites} 
                        loading={loading} 
                        error={null} 
                        onSiteDeleted={fetchSiteStatus} 
                    />
                </>
            )}
          </div>
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
