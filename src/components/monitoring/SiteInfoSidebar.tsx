import React from 'react';
import { Card, Text, Metric, Grid, Badge } from '@tremor/react';
import { MonitoredSite } from '../../types';
import { CountryToEmoji } from '../../components/CountryToEmoji'; // Ensure this component exists

interface SiteInfoSidebarProps {
  site: MonitoredSite;
}

export const SiteInfoSidebar: React.FC<SiteInfoSidebarProps> = ({ site }) => {
  const lastCheckedDate = site.latest_ping ? new Date(site.latest_ping.checked_at) : null;
  const formattedLastChecked = lastCheckedDate 
    ? `${lastCheckedDate.toLocaleDateString()} at ${lastCheckedDate.toLocaleTimeString()}`
    : 'Never';

  return (
    <Card>
        <Text className="text-xs uppercase font-medium text-gray-500 mb-2">Site Details</Text>
        <Grid numItems={2} className="gap-y-4">
            <div>
                <Text className="text-sm text-gray-600">Country</Text>
                <Text className="flex items-center">
                    <CountryToEmoji countryCode={site.country} /> 
                    <span className="ml-2">{site.country || 'Unknown'}</span>
                </Text>
            </div>
            <div>
                <Text className="text-sm text-gray-600">Last Checked</Text>
                <Text>{formattedLastChecked}</Text>
            </div>
            <div>
                <Text className="text-sm text-gray-600">Created</Text>
                <Text>{new Date(site.created_at).toLocaleDateString()}</Text>
            </div>
        </Grid>
    </Card>
  );
};