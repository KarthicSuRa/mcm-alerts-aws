import React from 'react';
import { Card, Flex, Text, Metric } from '@tremor/react';
import { MonitoredSite } from '../../types';
import { cn } from '../../lib/utils';

interface CurrentStatusCardProps {
    site: MonitoredSite;
}

export const CurrentStatusCard: React.FC<CurrentStatusCardProps> = ({ site }) => {
    const isUp = site.latest_ping?.is_up ?? false;
    const latency = site.latest_ping?.response_time_ms ?? 0;
    const statusText = isUp ? 'Online' : 'Offline';
    const statusColor = isUp ? 'bg-green-500' : 'bg-red-500';

    return (
        <Card>
            <Flex alignItems="start">
                <Text>Current Status</Text>
            </Flex>
            <Flex className="space-x-3 truncate" justifyContent="start" alignItems="baseline">
                <Metric className={cn("font-semibold", isUp ? 'text-green-600' : 'text-red-600')}>{statusText}</Metric>
                {isUp && <Text>({latency}ms)</Text>}
            </Flex>
             <div className="mt-4">
                <span className={cn("inline-block w-3 h-3 rounded-full", statusColor)}></span>
                <Text className="ml-2">{site.latest_ping?.checked_at ? new Date(site.latest_ping.checked_at).toLocaleString() : 'No data'}</Text>
            </div>
        </Card>
    );
};