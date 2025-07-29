import React from 'react';
import { SystemStatusData } from '../../types';

const StatusIndicator: React.FC<{ color: string; label: string }> = ({ color, label }) => (
    <div className="flex items-center gap-2">
        <span className={`w-2.5 h-2.5 rounded-full ${color}`}></span>
        <span className="text-sm text-popover-foreground/80">{label}</span>
    </div>
);

interface SystemStatusProps {
    status: SystemStatusData;
}

export const SystemStatus: React.FC<SystemStatusProps> = ({ status }) => (
    <div>
        <h4 className="text-base font-semibold text-left mb-3">System Status</h4>
        <div className="grid grid-cols-1 gap-2">
           <StatusIndicator color={status.service === 'Ready' ? 'bg-green-500' : 'bg-red-500'} label={`Service: ${status.service}`} />
           <StatusIndicator color={status.database === 'Connected' ? 'bg-green-500' : 'bg-red-500'} label={`Database: ${status.database}`} />
           <StatusIndicator color={status.push === 'Supported' ? 'bg-green-500' : 'bg-red-500'} label={`Push Service: ${status.push}`} />
           <StatusIndicator color={status.subscription === 'Active' ? 'bg-green-500' : 'bg-yellow-500'} label={`Subscription: ${status.subscription}`} />
        </div>
    </div>
);
