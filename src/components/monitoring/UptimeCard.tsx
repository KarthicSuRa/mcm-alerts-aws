import React from 'react';
import { Card, Flex, Text, Metric } from '@tremor/react';
import { cn } from '../../lib/utils';

interface UptimeCardProps {
    label: string;
    stats?: {
        percentage: number;
        incidents: number;
    };
}

export const UptimeCard: React.FC<UptimeCardProps> = ({ label, stats }) => {
    return (
        <Card>
            <Text>{label}</Text>
            <Metric className={cn(
                'mt-2',
                stats && stats.percentage >= 99.9 ? 'text-green-600' : stats && stats.percentage < 95 ? 'text-red-500' : 'text-yellow-500'
            )}>{stats ? `${stats.percentage}%` : 'N/A'}</Metric>
            <Flex className="mt-4" justifyContent="start" alignItems="baseline">
                <Text>{stats ? `${stats.incidents} incidents` : 'No data'}</Text>
            </Flex>
        </Card>
    );
};