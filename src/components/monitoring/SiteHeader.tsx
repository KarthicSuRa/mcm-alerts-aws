import React from 'react';
import { MonitoredSite } from '../../types';
import { Button } from '../ui/Button';
import { Icon } from '@iconify/react';

interface SiteHeaderProps {
    site: MonitoredSite;
}

export const SiteHeader: React.FC<SiteHeaderProps> = ({ site }) => {
    return (
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
                <h1 className="text-2xl font-bold">{site.name}</h1>
                <a href={site.url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary">
                    {site.url}
                </a>
            </div>
            <div className="mt-4 md:mt-0 flex space-x-2">
                <Button>
                    <Icon icon="heroicons:pencil" className="mr-2 h-4 w-4" />
                    Edit
                </Button>
                <Button>
                    <Icon icon="heroicons:cog" className="mr-2 h-4 w-4" />
                    Settings
                </Button>
            </div>
        </div>
    );
};