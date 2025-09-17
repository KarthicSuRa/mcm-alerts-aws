import React from 'react';
import { WebhookSource } from '../../types';
import { WebhookItem } from './WebhookItem';

// Correct the props to expect the nested topics object
interface WebhookListProps {
  webhooks: (WebhookSource & { topics?: { name: string } | null })[];
  onDelete: (id: string) => void;
}

export const WebhookList: React.FC<WebhookListProps> = ({ webhooks, onDelete }) => {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-border">
        <thead className="bg-muted/50">
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Name
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Linked Topic
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Webhook URL
            </th>
            <th scope="col" className="relative px-6 py-3">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="bg-card divide-y divide-border">
          {webhooks.map((webhook) => (
            <WebhookItem key={webhook.id} webhook={webhook} onDelete={onDelete} />
          ))}
        </tbody>
      </table>
    </div>
  );
};
