import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { MonitoredSite, PingLog, Incident } from '../types';

const calculateIncidents = (pings: PingLog[]): Incident[] => {
    const incidents: Incident[] = [];
    let currentIncident: Partial<Incident> | null = null;

    const chronologicalPings = [...pings].reverse();

    for (const ping of chronologicalPings) {
        if (!ping.is_up && !currentIncident) {
            currentIncident = {
                started_at: ping.checked_at,
                reason: ping.status_text || 'Service Unavailable',
                is_resolved: false,
            };
        } else if (ping.is_up && currentIncident && currentIncident.started_at) {
            const startTime = new Date(currentIncident.started_at).getTime();
            const endTime = new Date(ping.checked_at).getTime();
            const durationMs = endTime - startTime;
            
            const seconds = Math.floor(durationMs / 1000);
            const minutes = Math.floor(seconds / 60);
            const hours = Math.floor(minutes / 60);
            const duration_human = hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m ${seconds % 60}s`;

            incidents.unshift({ 
                ...currentIncident,
                started_at: currentIncident.started_at,
                reason: currentIncident.reason || 'Service Unavailable',
                duration_human,
                is_resolved: true,
            });
            currentIncident = null;
        }
    }

    if (currentIncident && currentIncident.started_at) {
        const startTime = new Date(currentIncident.started_at).getTime();
        const now = new Date().getTime();
        const durationMs = now - startTime;
        const seconds = Math.floor(durationMs / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const duration_human = hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m ${seconds % 60}s`;

        incidents.unshift({
            ...currentIncident,
            started_at: currentIncident.started_at,
            reason: currentIncident.reason || 'Service Unavailable',
            duration_human,
            is_resolved: false,
        });
    }

    return incidents;
};

const fetchSiteData = async (siteId: string): Promise<MonitoredSite | null> => {
    if (!siteId) return null;

    // Handle demo site
    if (siteId === 'demo-site') {
        return {
            id: 'demo-site',
            name: 'MCM SG-DEVAP02 (Test)',
            url: 'https://sg-devap02.mcmworldwide.com',
            country: 'Test Site',
            status: 'online',
            latest_ping: {
                is_up: true,
                response_time_ms: 150,
                checked_at: new Date().toISOString(),
            } as PingLog,
            ping_logs: [],
            incidents: [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            latitude: 0,
            longitude: 0,
        };
    }

    const { data: monitoredSiteData, error: monitoredSiteError } = await supabase
        .from('monitored_sites')
        .select('*')
        .eq('id', siteId)
        .single();

    if (monitoredSiteError) {
        console.error(`Error fetching monitored site ${siteId}:`, monitoredSiteError);
        throw new Error(`Failed to fetch site data: ${monitoredSiteError.message}`);
    }

    if (!monitoredSiteData) {
        return null;
    }

    const { data: pingLogs, error: logsError } = await supabase
        .from('ping_logs')
        .select('*')
        .eq('site_id', siteId)
        .order('checked_at', { ascending: false });

    if (logsError) {
        console.error(`Error fetching ping logs for site ${siteId}:`, logsError);
    }
    
    const incidents = calculateIncidents(pingLogs || []);

    return {
        ...monitoredSiteData,
        ping_logs: pingLogs || [],
        incidents: incidents,
        latest_ping: pingLogs && pingLogs.length > 0 ? pingLogs[0] : undefined,
        status: pingLogs && pingLogs.length > 0 ? (pingLogs[0].is_up ? 'online' : 'offline') : 'unknown',
    };
};

export const useMonitoringData = (siteId: string) => {
    const [site, setSite] = useState<MonitoredSite | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        if (!siteId) {
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const data = await fetchSiteData(siteId);
            setSite(data);
        } catch (e: any) {            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, [siteId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return { site, loading, error, refresh: fetchData };
};
