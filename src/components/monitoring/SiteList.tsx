import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MonitoredSite } from '../../types';
import { supabase } from '../../lib/supabaseClient';
import { Button } from '../ui/Button';

interface SiteListProps {
  sites: MonitoredSite[];
  loading: boolean;
  error: string | null;
  onSiteDeleted: () => void;
}

// Helper to get full country name from code
const getCountryName = (code: string): string => {
    const codeMap: {[key: string]: string} = {
        'IN': 'India',
        'AE': 'United Arab Emirates',
        'AT': 'Austria',
        'AU': 'Australia',
        'BE': 'Belgium',
        'CA': 'Canada',
        'CH': 'Switzerland',
        'CN': 'China',
        'CZ': 'Czech Republic',
        'DE': 'Germany',
        'DK': 'Denmark',
        'ES': 'Spain',
        'FI': 'Finland',
        'FR': 'France',
        'GR': 'Greece',
        'HK': 'Hong Kong',
        'IE': 'Ireland',
        'IT': 'Italy',
        'JP': 'Japan',
        'KR': 'South Korea',
        'LU': 'Luxembourg',
        'MY': 'Malaysia',
        'NL': 'Netherlands',
        'NO': 'Norway',
        'NZ': 'New Zealand',
        'PL': 'Poland',
        'PT': 'Portugal',
        'SE': 'Sweden',
        'SG': 'Singapore',
        'TH': 'Thailand',
        'TW': 'Taiwan',
        'UK': 'United Kingdom',
        'US': 'United States',
    };
    return codeMap[code.toUpperCase()] || code;
};

const SiteList: React.FC<SiteListProps> = ({ sites, loading, error, onSiteDeleted }) => {
    const navigate = useNavigate();
    const [showConfirm, setShowConfirm] = useState<string | null>(null);

    const groupedSites = React.useMemo(() => {
        const groups = sites.reduce((acc, site) => {
            const country = getCountryName(site.country || 'Global');
            if (!acc[country]) {
                acc[country] = [];
            }
            acc[country].push(site);
            return acc;
        }, {} as Record<string, MonitoredSite[]>);
        
        return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));

    }, [sites]);

    const handleDelete = async (siteId: string) => {
        setShowConfirm(null);
        try {
            const { error } = await supabase.from('monitored_sites').delete().eq('id', siteId);
            if (error) throw error;
            onSiteDeleted();
        } catch (e: any) {
            console.error("Error deleting site:", e.message);
        }
    };

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
                            <th scope="col" className="w-48 px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Country</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Site</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Response Time (ms)</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Last Checked</th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    {groupedSites.map(([country, countrySites]) => (
                        <tbody key={country} className="divide-y divide-border">
                            {countrySites.map((site, index) => {
                                const latestPing = site.latest_ping;
                                const isUp = latestPing?.is_up;
                                const statusText = isUp ? 'Up' : (isUp === false ? 'Down' : 'Unknown');

                                return (
                                    <tr 
                                        key={site.id} 
                                        className="hover:bg-muted/50 cursor-pointer"
                                        onClick={() => navigate(`/monitoring/${site.id}`)}
                                    >
                                        {index === 0 && (
                                            <td rowSpan={countrySites.length} className="px-6 py-4 align-middle whitespace-nowrap text-sm font-medium text-foreground">
                                                {country}
                                            </td>
                                        )}
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className={`h-3 w-3 rounded-full mr-3 flex-shrink-0 ${isUp ? 'bg-green-500' : isUp === false ? 'bg-red-500' : 'bg-gray-400'}`}></div>
                                                <div className="truncate">
                                                    <div className="text-sm font-medium text-foreground truncate">{site.name}</div>
                                                    <a 
                                                        href={site.url} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer" 
                                                        className="text-sm text-muted-foreground hover:text-primary truncate"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        {site.url}
                                                    </a>
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
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-right">
                                            <>
                                                {showConfirm === site.id ? (
                                                    <div onClick={(e) => e.stopPropagation()}>
                                                        <Button variant="destructive" size="sm" onClick={() => handleDelete(site.id)}>Confirm</Button>
                                                        <Button variant="ghost" size="sm" onClick={(e) => {e.stopPropagation(); setShowConfirm(null);}}>Cancel</Button>
                                                    </div>
                                                ) : (
                                                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setShowConfirm(site.id); }}>
                                                        Delete
                                                    </Button>
                                                )}
                                            </>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    ))}
                </table>
                {sites.length === 0 && (
                    <p className="p-4 text-center text-muted-foreground">No sites found for this region.</p>
                )}
            </div>
        </div>
    );
};

export default SiteList;
