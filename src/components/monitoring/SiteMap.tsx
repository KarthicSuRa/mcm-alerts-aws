import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import { MonitoredSite } from '../../types';
import { LatLngBounds } from 'leaflet';

const AutoFitBounds: React.FC<{ sites: MonitoredSite[] }> = ({ sites }) => {
  const map = useMap();

  useEffect(() => {
    if (!sites || sites.length === 0) return;

    const validSites = sites.filter(site => site.latitude !== null && site.longitude !== null);
    if (validSites.length === 0) return;

    const bounds = new LatLngBounds(validSites.map(site => [site.latitude!, site.longitude!]));
    
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [sites, map]);

  return null;
};

const SiteMarkers: React.FC<{ sites: MonitoredSite[] }> = ({ sites }) => {
  return (
    <>
      {sites.map(site => {
        const latestLog = site.ping_logs?.[0];
        const isUp = latestLog?.is_up ?? false;

        return (
          <CircleMarker
            key={site.id}
            center={[site.latitude!, site.longitude!]}
            radius={8}
            pathOptions={{
              color: isUp ? '#22c55e' : '#ef4444',
              fillColor: isUp ? '#22c55e' : '#ef4444',
              fillOpacity: 0.8,
              weight: 1,
            }}
          >
            <Popup>
              <div className="font-sans">
                <h3 className="font-bold text-lg mb-2">{site.name}</h3>
                <p><strong>Status:</strong> <span className={isUp ? 'text-green-600' : 'text-red-600'}>{isUp ? 'Up' : 'Down'}</span></p>
                <p><strong>URL:</strong> <a href={site.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">{site.url}</a></p>
                {latestLog && (
                  <>
                    <p><strong>Last Check:</strong> {new Date(latestLog.checked_at).toLocaleString()}</p>
                    <p><strong>Response Time:</strong> {latestLog.response_time_ms} ms</p>
                  </>
                )}
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </>
  );
};

type ViewType = 'Global' | 'Europe' | 'North America' | 'Asia Pacific';

interface SiteMapProps {
  sites: MonitoredSite[];
  loading: boolean;
  error: string | null;
}

const SiteMap: React.FC<SiteMapProps> = ({ sites, loading, error }) => {
  const [activeView, setActiveView] = useState<ViewType>('Global');

  const validSites = sites.filter(site => site.latitude !== null && site.longitude !== null);

  const europeSites = validSites.filter(
    site => site.latitude! > 35 && site.latitude! < 70 && site.longitude! > -10 && site.longitude! < 40
  );
  const northAmericaSites = validSites.filter(
    site => site.latitude! > 25 && site.latitude! < 70 && site.longitude! > -140 && site.longitude! < -50
  );
  const asiaPacificSites = validSites.filter(
    site => site.latitude! > -50 && site.latitude! < 70 && site.longitude! > 60 && site.longitude! < 180
  );
  
  const lightTileUrl = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
  const tileAttribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

  const views: { name: ViewType; sites: MonitoredSite[]; center: [number, number]; zoom: number; }[] = [
    { name: 'Global', sites: validSites, center: [20, 0], zoom: 2 },
    { name: 'Europe', sites: europeSites, center: [50, 15], zoom: 3.5 },
    { name: 'North America', sites: northAmericaSites, center: [45, -95], zoom: 3 },
    { name: 'Asia Pacific', sites: asiaPacificSites, center: [25, 120], zoom: 3 },
  ];

  const currentView = views.find(v => v.name === activeView)!;

  return (
    <div className="bg-card rounded-lg shadow p-4 flex flex-col h-full">
      <div className="flex border-b mb-4 flex-shrink-0">
        {views.map(view => (
          <button
            key={view.name}
            onClick={() => setActiveView(view.name)}
            className={`px-4 py-2 -mb-px font-medium text-sm transition-colors duration-200 ease-in-out 
              ${activeView === view.name 
                ? 'border-b-2 border-primary text-primary' 
                : 'text-muted-foreground hover:text-foreground'}`
            }
          >
            {view.name} ({view.sites.length})
          </button>
        ))}
      </div>

      {loading && <div className="flex items-center justify-center h-full"><p>Loading map...</p></div>}
      {error && <div className="flex items-center justify-center h-full"><p className="text-red-500">{error}</p></div>}
      {!loading && !error && (
        <div className="flex-grow">
          <MapContainer 
            key={activeView} 
            center={currentView.center} 
            zoom={currentView.zoom} 
            style={{ height: '100%', width: '100%' }} 
            className="rounded-lg shadow-md z-0"
          >
            <TileLayer url={lightTileUrl} attribution={tileAttribution} />
            {activeView === 'Global' && <AutoFitBounds sites={currentView.sites} />}
            <SiteMarkers sites={currentView.sites} />
          </MapContainer>
        </div>
      )}
    </div>
  );
};

export default SiteMap;
