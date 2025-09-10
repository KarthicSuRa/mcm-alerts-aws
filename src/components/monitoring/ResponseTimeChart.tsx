import React from 'react';
import { Card, Title, AreaChart } from '@tremor/react';
import { PingLog } from '../../types';

interface ResponseTimeChartProps {
    pings: PingLog[];
}

export const ResponseTimeChart: React.FC<ResponseTimeChartProps> = ({ pings }) => {
    const chartData = pings.slice(0, 100).map(ping => ({
        time: new Date(ping.checked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        'Response Time (ms)': ping.response_time_ms, // Corrected prop
    })).reverse();

    return (
        <Card>
            <Title>Response Time Over Last 100 Checks</Title>
            <AreaChart
                className="h-72 mt-4"
                data={chartData}
                index="time"
                categories={['Response Time (ms)']}
                colors={['blue']} // Using a vibrant color
                yAxisWidth={60}
                valueFormatter={(number: number) => `${number} ms`}
                showLegend={false}
            />
        </Card>
    );
};