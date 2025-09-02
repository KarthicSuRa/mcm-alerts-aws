import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { MonitoredSite } from '../../types';

const SiteList: React.FC = () => {
  const [sites, setSites] = useState<MonitoredSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSites = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error } = await supabase
          .from('monitored_sites')
          .select(`
            id, name, url, is_paused,
            ping_logs ( id, is_up, response_time_ms, status_code, checked_at )
          `)
          .order('name', { ascending: true });

        if (error) throw error;

        const sitesWithLatestPing = data?.map(site => {
          const latestPing = site.ping_logs?.sort((a, b) => new Date(b.checked_at).getTime() - new Date(a.checked_at).getTime())[0];
          return { ...site, latest_ping: latestPing };
        }) || [];

        setSites(sitesWithLatestPing);

      } catch (err: any) {
        console.error("Error fetching sites:", err);
        setError(`Failed to load sites: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchSites();

    // Set up a polling interval to refresh the data every minute
    const interval = setInterval(fetchSites, 60000);

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <p className="p-4 text-center text-muted-foreground">Loading sites...</p>;
  }

  if (error) {
    return <p className="p-4 text-center text-red-500">{error}</p>;
  }

  return (
    <div className="bg-card rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted/50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Site Name</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Response Time (ms)</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Last Checked</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sites.map(site => {
              const latestPing = site.latest_ping;
              const isUp = latestPing?.is_up;
              const statusText = isUp ? 'Up' : (isUp === false ? 'Down' : 'Unknown');

              return (
                <tr key={site.id} className="hover:bg-muted/50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className={`h-3 w-3 rounded-full mr-3 ${isUp ? 'bg-green-500' : isUp === false ? 'bg-red-500' : 'bg-gray-400'}`}></div>
                      <div>
                        <div className="text-sm font-medium">{site.name}</div>
                        <a href={site.url} target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:text-primary">{site.url}</a>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${isUp ? 'bg-green-100 text-green-800' : isUp === false ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>
                      {statusText}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{latestPing?.response_time_ms ?? 'N/A'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                    {latestPing?.checked_at ? new Date(latestPing.checked_at).toLocaleString() : 'Never'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {sites.length === 0 && (
          <p className="p-4 text-center text-muted-foreground">No sites found. Ensure the `monitored_sites` table is populated.</p>
        )}
      </div>
    </div>
  );
};

export default SiteList;
