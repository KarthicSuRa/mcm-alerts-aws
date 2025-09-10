import React from 'react';
import { Card, Title, Badge } from '@tremor/react';
import { Incident } from '../../types';
import { formatDistanceToNow } from '../../lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@tremor/react';

interface LatestIncidentsProps {
    incidents: Incident[];
}

export const LatestIncidents: React.FC<LatestIncidentsProps> = ({ incidents }) => {
    return (
        <Card>
            <Title>Latest Incidents</Title>
            <Table className="mt-5">
                <TableHead>
                    <TableRow>
                        <TableHeaderCell>Reason</TableHeaderCell>
                        <TableHeaderCell>Started</TableHeaderCell>
                        <TableHeaderCell>Duration</TableHeaderCell>
                        <TableHeaderCell>Status</TableHeaderCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {incidents.map((incident, index) => (
                        <TableRow key={index}>
                            <TableCell>{incident.reason}</TableCell>
                            <TableCell>{formatDistanceToNow(new Date(incident.started_at))}</TableCell>
                            <TableCell>{incident.duration_human}</TableCell>
                            <TableCell>
                                <Badge color={incident.is_resolved ? 'green' : 'red'}>
                                    {incident.is_resolved ? 'Resolved' : 'Ongoing'}
                                </Badge>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </Card>
    );
};