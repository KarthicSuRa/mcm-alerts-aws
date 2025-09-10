import React from 'react';
import { Card, Flex, Text } from '@tremor/react';
import { Icon } from '@iconify/react';
import { MonitoredSite } from '../../types';

interface SiteCreationCardProps {
    site: MonitoredSite | null;
}

export const SiteCreationCard: React.FC<SiteCreationCardProps> = ({ site }) => {
    const creationDate = site?.created_at ? new Date(site.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A';

    return (
        <Card className="p-4 md:p-6">
            <Flex alignItems="start">
                <Text className="font-semibold">Site Creation</Text>
                <Icon icon="heroicons:calendar-days-20-solid" className="w-6 h-6 text-muted-foreground" />
            </Flex>
            <Text className="text-3xl font-bold mt-2">{creationDate}</Text>
            <Text className="text-sm text-muted-foreground mt-1">The date this site was first monitored.</Text>
        </Card>
    );
};