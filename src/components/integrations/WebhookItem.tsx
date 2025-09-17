import React, { useState } from 'react';
import { WebhookSource } from '../../types';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';

const getWebhookUrl = (sourceId: string): string => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) return "VITE_SUPABASE_URL not set";
  return `${supabaseUrl}/functions/v1/rapid-api?source_id=${sourceId}`;
};

// The props now expect a `topics` object that might contain the name
interface WebhookItemProps {
  webhook: WebhookSource & { topics?: { name: string } | null };
  onDelete: (id: string) => void;
}

export const WebhookItem: React.FC<WebhookItemProps> = ({ webhook, onDelete }) => {
  const [copied, setCopied] = useState(false);
  const fullUrl = getWebhookUrl(webhook.id);

  const handleCopy = () => {
    navigator.clipboard.writeText(fullUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Safely access the topic name
  const topicName = webhook.topics?.name;

  return (
    <tr>
      <td className="px-6 py-4 align-top">
        <div className="text-sm font-semibold text-foreground">{webhook.name}</div>
        <div className="text-xs text-muted-foreground mt-1">{webhook.description}</div>
      </td>
      <td className="px-6 py-4 align-top">
        {topicName ? (
            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-primary/10 text-primary">
                {topicName}
            </span>
        ) : (
            <span className="text-xs text-muted-foreground italic">Not linked</span>
        )}
      </td>
      <td className="px-6 py-4 align-top">
        <div className="flex items-center max-w-xs">
            <span className="font-mono text-xs p-2 bg-muted rounded-md break-all">{fullUrl}</span>
            <Button variant="ghost" size="icon" onClick={handleCopy} className="ml-2 flex-shrink-0">
                <Icon name={copied ? "check" : "copy"} className="w-4 h-4" />
            </Button>
        </div>
      </td>
      <td className="px-6 py-4 align-top text-right">
        <Button variant="destructive" size="sm" onClick={() => onDelete(webhook.id)}>
          <Icon name="trash" className="w-4 h-4 mr-2"/>
          Delete
        </Button>
      </td>
    </tr>
  );
};
