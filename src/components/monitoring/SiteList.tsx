import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { MonitoredSite } from '../../types';

interface SiteListProps {
  sites: MonitoredSite[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

const SiteList: React.FC<SiteListProps> = ({ sites, loading, error, refetch }) => {
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
