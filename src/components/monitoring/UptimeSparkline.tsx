import React from 'react';
import { Card, Flex, Text } from '@tremor/react';
import { PingLog } from '../../types';
import { SparkAreaChart } from '@tremor/react';

interface UptimeSparklineProps {
    pings: PingLog[];
}

export const UptimeSparkline: React.FC<UptimeSparklineProps> = ({ pings }) => {
    const chartData = pings.map(ping => ({
        date: new Date(ping.checked_at),
        Uptime: ping.is_up ? 1 : 0,
    }));

    const uptimePercentage = (pings.filter(p => p.is_up).length / pings.length) * 100;

    return (
        <Card>
            <Text>Uptime (Last 60 Pings)</Text>
            <Flex justifyContent="between" alignItems="center">
                <Text className="text-2xl font-semibold text-green-600">{`${uptimePercentage.toFixed(2)}%`}</Text>
                <SparkAreaChart
                    data={chartData}
                    categories={['Uptime']}
                    index={"date"}
                    colors={['green']}
                    className="h-10 w-36"
                />
            </Flex>
        </Card>
    );
};