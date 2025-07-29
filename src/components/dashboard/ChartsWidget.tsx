import React, { useState, useMemo, useContext } from 'react';
import { Notification } from '../../types';
import { Icon } from '../ui/Icon';
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ThemeContext } from '../../contexts/ThemeContext';

interface ChartsWidgetProps {
  notifications: Notification[];
}

type ChartType = 'bar' | 'pie' | 'line';
type TimeFilter = '24h' | '7d' | 'all';

const COLORS = {
    high: 'hsl(var(--destructive))',
    medium: 'hsl(var(--primary))',
    low: 'hsl(220 9% 69%)',
    new: 'hsl(var(--destructive))',
    acknowledged: 'hsl(var(--success))',
    resolved: 'hsl(var(--primary))',
};

const ChartsWidget: React.FC<ChartsWidgetProps> = ({ notifications }) => {
    const [chartType, setChartType] = useState<ChartType>('bar');
    const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
    const themeContext = useContext(ThemeContext);
    const tickColor = 'hsl(var(--muted-foreground))';
    const gridColor = 'hsl(var(--border))';
    const primaryColor = 'hsl(var(--primary))';

    const filteredNotifications = useMemo(() => {
        if (timeFilter === 'all') return notifications;
        const now = new Date();
        const filterDate = new Date();
        if (timeFilter === '24h') {
            filterDate.setHours(now.getHours() - 24);
        } else if (timeFilter === '7d') {
            filterDate.setDate(now.getDate() - 7);
        }
        return notifications.filter(n => new Date(n.timestamp) > filterDate);
    }, [notifications, timeFilter]);

    const chartData = useMemo(() => {
        const statusData = [
            { name: 'New', count: filteredNotifications.filter(n => n.status === 'new').length, fill: COLORS.new },
            { name: 'Ack', count: filteredNotifications.filter(n => n.status === 'acknowledged').length, fill: COLORS.acknowledged },
            { name: 'Resolved', count: filteredNotifications.filter(n => n.status === 'resolved').length, fill: COLORS.resolved },
        ];

        const severityData = [
            { name: 'High', value: filteredNotifications.filter(n => n.severity === 'high').length, color: COLORS.high },
            { name: 'Medium', value: filteredNotifications.filter(n => n.severity === 'medium').length, color: COLORS.medium },
            { name: 'Low', value: filteredNotifications.filter(n => n.severity === 'low').length, color: COLORS.low },
        ].filter(d => d.value > 0);

        const timeData = filteredNotifications
            .sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
            .reduce((acc, n) => {
                const date = new Date(n.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric'});
                const existing = acc.find(item => item.date === date);
                if (existing) {
                    existing.count += 1;
                } else {
                    acc.push({ date, count: 1 });
                }
                return acc;
            }, [] as {date: string, count: number}[]);

        return { status: statusData, severity: severityData, time: timeData };
    }, [filteredNotifications]);

    const CustomTooltip = ({ active, payload, label }: any) => {
      if (active && payload && payload.length) {
        return (
          <div className="p-2 text-sm bg-card/80 backdrop-blur-sm border border-border rounded-md shadow-lg">
            <p className="label font-bold text-foreground">{`${label}`}</p>
            <p className="intro text-muted-foreground">{`${payload[0].name} : ${payload[0].value}`}</p>
          </div>
        );
      }
      return null;
    };
    
    const renderChart = () => {
        switch(chartType) {
            case 'pie':
                return (
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie data={chartData.severity} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} cornerRadius={5} labelLine={false}>
                                {chartData.severity.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} stroke={entry.color} />)}
                            </Pie>
                            <Tooltip content={<CustomTooltip />} />
                            <Legend iconSize={10} wrapperStyle={{ fontSize: '12px' }} />
                        </PieChart>
                    </ResponsiveContainer>
                );
            case 'line':
                 return (
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData.time} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                            <defs>
                                <linearGradient id="lineGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={primaryColor} stopOpacity={0.4}/>
                                    <stop offset="95%" stopColor={primaryColor} stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                            <XAxis dataKey="date" stroke={tickColor} fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis stroke={tickColor} fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                            <Tooltip content={<CustomTooltip />} />
                            <Line type="monotone" dataKey="count" name="Alerts" stroke={primaryColor} strokeWidth={2} dot={{ r: 4, fill: primaryColor, stroke: 'hsl(var(--background))', strokeWidth: 2 }} activeDot={{ r: 6 }} fill="url(#lineGradient)"/>
                        </LineChart>
                    </ResponsiveContainer>
                );
            case 'bar':
            default:
                return (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData.status} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                            <XAxis dataKey="name" stroke={tickColor} fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis stroke={tickColor} fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                            <Tooltip content={<CustomTooltip />} />
                            <Bar dataKey="count" name="Count" radius={[4, 4, 0, 0]}>
                                {chartData.status.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                );
        }
    }

    return (
        <div className="bg-gradient-to-br from-card to-secondary/20 p-4 rounded-xl border border-border shadow-lg shadow-black/5">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
                <h3 className="text-xl font-semibold">Analytics</h3>
                <div className="flex gap-2">
                    <select 
                        value={timeFilter}
                        onChange={(e) => setTimeFilter(e.target.value as TimeFilter)}
                        className="text-xs rounded-md border-border shadow-sm focus:border-ring focus:ring-ring bg-transparent"
                    >
                        <option value="all">All Time</option>
                        <option value="7d">Last 7d</option>
                        <option value="24h">Last 24h</option>
                    </select>
                    <select 
                        value={chartType}
                        onChange={(e) => setChartType(e.target.value as ChartType)}
                        className="text-xs rounded-md border-border shadow-sm focus:border-ring focus:ring-ring bg-transparent"
                    >
                        <option value="bar">By Status</option>
                        <option value="pie">By Severity</option>
                        <option value="line">Over Time</option>
                    </select>
                </div>
            </div>
            <div className="h-64">
                 {chartData.time.length > 0 || chartData.severity.length > 0 || chartData.status.some(s => s.count > 0) ? renderChart() : 
                 <div className="flex items-center justify-center h-full text-muted-foreground">No data for selected period</div>}
            </div>
        </div>
    );
};

export default ChartsWidget;
