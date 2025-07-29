import { Severity, NotificationStatus } from './types';

export const SEVERITY_INFO: { [key in Severity]: { color: string; icon: string } } = {
  low: { color: 'text-gray-500', icon: 'info' },
  medium: { color: 'text-primary', icon: 'alert' },
  high: { color: 'text-destructive', icon: 'alert' },
};

export const STATUS_INFO: { [key in NotificationStatus]: { bg: string; text: string; icon: string } } = {
    new: { bg: 'bg-destructive/10', text: 'text-destructive', icon: 'alert-circle' },
    acknowledged: { bg: 'bg-success/10', text: 'text-success', icon: 'check-circle' },
    resolved: { bg: 'bg-primary/10', text: 'text-primary', icon: 'shield-check' },
};
