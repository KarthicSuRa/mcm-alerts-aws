import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MonitoredSite } from '../../types';
import { format, parseISO } from 'date-fns';

const createStatusIcon = (status: 'online' | 'offline' | 'unknown') => {
    const color = status === 'online' ? '#22c55e' : status === 'offline' ? '#ef4444' : '#9ca3af';
    const html = `<span style="background-color: ${color}; width: 12px; height: 12px; border-radius: 50%; display: block; border: 2px solid white;"></span>`;
    return new L.DivIcon({
        html: html,
        className: 'bg-transparent',
        iconSize: [12, 12],
        iconAnchor: [6, 6]
    });
};

interface SiteMapProps {
    sites: MonitoredSite[];
    loading: boolean;
    error: string | null;
    center: L.LatLngExpression;
    zoom: number;
}

// Component to handle map view changes
const ChangeView = ({ center, zoom }: { center: L.LatLngExpression; zoom: number }) => {
    const map = useMap();
    useEffect(() => {
        map.flyTo(center, zoom, { animate: true, duration: 0.8 });
    }, [center, zoom, map]);
    return null;
};

export default function SiteMap({ sites, loading, error, center, zoom }: SiteMapProps) {
    const [currentTheme, setCurrentTheme] = useState(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    const [tileLayerKey, setTileLayerKey] = useState(Date.now());

    useEffect(() => {
        const observer = new MutationObserver(() => {
            const newTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
            if (newTheme !== currentTheme) {
                setCurrentTheme(newTheme);
                setTileLayerKey(Date.now());
            }
        });
        observer.observe(document.documentElement, { attributes: true });
        return () => observer.disconnect();
    }, [currentTheme]);

    const mapUrl = currentTheme === 'dark' 
        ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" 
        : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
    const attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

    if (loading) return <div className="flex items-center justify-center h-full"><p>Loading map...</p></div>;
    if (error) return <div className="flex items-center justify-center h-full"><p className="text-red-500">Error: {error}</p></div>;

    const displayedSites = sites.filter(s => s.latitude && s.longitude);

    return (
      <MapContainer center={center} zoom={zoom} scrollWheelZoom={false} className="h-full w-full bg-card rounded-lg shadow-inner z-0">
          <ChangeView center={center} zoom={zoom} />
          <TileLayer key={tileLayerKey} url={mapUrl} attribution={attribution} />
          {displayedSites.map(site => (
              <Marker key={site.id} position={[site.latitude!, site.longitude!]} icon={createStatusIcon(site.status as any)}>
                  <Popup>
                      <div className="text-sm">
                          <b className="font-semibold text-base">{site.name}</b><br/>
                          <span className={`capitalize font-medium ${site.status === 'online' ? 'text-green-500' : 'text-red-500'}`}>
                              Status: {site.status}
                          </span><br/>
                          <span className="text-gray-500 dark:text-gray-400">
                              Last Checked: {site.last_checked ? format(parseISO(site.last_checked), 'Pp') : 'N/A'}
                          </span>
                      </div>
                  </Popup>
              </Marker>
          ))}
      </MapContainer>
  );
}
