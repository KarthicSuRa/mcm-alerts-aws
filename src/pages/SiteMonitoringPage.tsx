import React from 'react';
import SiteList from '../components/monitoring/SiteList';
import SiteMap from '../components/monitoring/SiteMap';
import { Icon } from '../components/ui/Icon';

interface SiteMonitoringPageProps {
  onNavigate: (page: string) => void;
}

export const SiteMonitoringPage: React.FC<SiteMonitoringPageProps> = ({ onNavigate }) => {
  return (
    <div className="p-4 md:p-6 lg:p-8 text-foreground bg-background">
        <div className="flex items-center mb-6">
            <button onClick={() => onNavigate('dashboard')} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 mr-4 lg:hidden">
                <Icon name="arrow-left" className="h-5 w-5 text-gray-700 dark:text-gray-300" />
            </button>
            <h1 className="text-3xl font-bold">Site Monitoring</h1>
        </div>

      {/* Map View */}
      <div className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Site Availability Map</h2>
        <SiteMap />
      </div>

      {/* List View */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">All Monitored Sites</h2>
        <SiteList />
      </div>
    </div>
  );
};
