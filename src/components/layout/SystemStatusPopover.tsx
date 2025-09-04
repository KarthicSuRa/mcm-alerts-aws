import React from 'react';
import { SystemStatusData } from '../../types';
import { format, parseISO } from 'date-fns';

interface SystemStatusPopoverProps {
    status: SystemStatusData;
}

const statusDetails = {
    operational: {
        title: 'All Systems Operational',
        color: 'text-green-500',
    },
    degraded_performance: {
        title: 'Degraded Performance',
        color: 'text-yellow-500',
    },
    major_outage: {
        title: 'Major Outage',
        color: 'text-red-500',
    },
    unknown: {
        title: 'Status Unknown',
        color: 'text-gray-500',
    },
};

export const SystemStatusPopover: React.FC<SystemStatusPopoverProps> = ({ status }) => {
    const currentStatus = status?.status || 'unknown';
    const details = statusDetails[currentStatus];

    return (
        <div className="absolute right-0 mt-12 w-80 bg-card border border-border rounded-md shadow-lg z-10 p-4">
            <div className="flex items-center mb-3">
                <h3 className={`text-lg font-semibold ${details.color}`}>{details.title}</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
                {status?.message || 'There are no new updates at this time.'}
            </p>
            <div className="text-xs text-muted-foreground">
                Last updated: {status?.last_updated ? format(parseISO(status.last_updated), 'PPP p') : 'N/A'}
            </div>
        </div>
    );
};
