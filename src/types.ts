export interface User {
  id: string;
  email?: string;
  full_name?: string | null;
  avatar_url?: string;
  app_role?: string;
  team_id?: string | null;
}

export interface Team {
    id: string;
    name: string;
    created_at: string | null;
    created_by: string | null;
    members?: User[];
}

export interface TeamMember {
    team_id: string;
    user_id: string;
    team_role: string;
    created_at: string | null;
}

export type Theme = 'light' | 'dark';

export interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

export type Severity = 'low' | 'medium' | 'high';

export type NotificationStatus = 'new' | 'acknowledged' | 'resolved';

export interface Comment {
  id: string;
  text: string;
  created_at: string;
  notification_id: string;
  user_id: string;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  severity: Severity;
  status: NotificationStatus;
  timestamp: string;
  site: string | null;
  comments: Comment[];
  topic_id: string | null;
  created_at: string;
  updated_at: string;
  acknowledgedAt?: string;
  acknowledged_by?: string;
  resolvedAt?: string;
}

export interface NotificationUpdatePayload {
  id?: string
  created_at?: string
  updated_at?: string
  type?: string
  title?: string
  message?: string
  severity?: 'low' | 'medium' | 'high'
  status?: 'new' | 'acknowledged' | 'resolved'
  timestamp?: string
  site?: string | null
  topic_id?: string | null
}

export interface Topic {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  subscribed?: boolean;
  subscription_id?: string;
  team_id: string | null;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  user: string;
  user_email?: string;
  action: string;
  details: string;
  notificationId: string;
}

export interface SystemStatusData {
  status: 'operational' | 'degraded_performance' | 'major_outage' | 'unknown';
  message: string;
  last_updated: string;
  service: 'Ready' | 'Error';
  database: 'Connected' | 'Disconnected';
  push: 'Supported' | 'Unsupported' | 'OneSignal';
  subscription: 'Active' | 'Inactive';
}

export interface OneSignalPlayer {
  id: string;
  user_id: string;
  player_id: string;
  created_at: string;
  updated_at: string;
}

export interface CalendarEvent {
  id: string;
  date: string;
  title: string;
  subtitle?: string;
  category: string;
  color: string;
}

export interface Category {
  id: string;
  name: string;
  color: string;
}

export interface PingLog {
    id: number;
    site_id: string;
    is_up: boolean;
    response_time_ms: number;
    status_code: number;
    status_text: string;
    checked_at: string;
}

export interface Incident {
  reason: string;
  started_at: string;
  duration_human: string;
  is_resolved: boolean;
}

export interface MonitoredSite {
  id: string;
  name: string;
  url: string;
  country: string;
  created_at: string;
  updated_at: string;
  latitude: number | null;
  longitude: number | null;
  status?: 'online' | 'offline' | 'unknown';
  ping_logs?: PingLog[];
  latest_ping?: PingLog;
  last_checked?: string;
  incidents?: Incident[];
}

export interface WebhookSource {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  source_type: string;
  created_at: string;
  topic_id: string | null;
}

export interface WebhookEvent {
  id: string;
  source_id: string;
  payload: any; 
  created_at: string;
}
