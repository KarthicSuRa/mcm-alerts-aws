import React from 'react';
import { SystemStatus } from './SystemStatus';
import { SystemStatusData } from '../../types';

interface SystemStatusPopoverProps {
    status: SystemStatusData;
}
export const SystemStatusPopover: React.FC<SystemStatusPopoverProps> = ({ status }) => {
    return (
        <div className="absolute right-0 mt-2 w-64 origin-top-right rounded-xl bg-popover text-popover-foreground shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-10">
            <div className="p-4">
                 <SystemStatus status={status} />
            </div>
        </div>
    )
}
