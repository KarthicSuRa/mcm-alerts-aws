import { Session } from '@supabase/supabase-js';

export interface Database {
  public: {
    Tables: {
      notifications: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          type: string
          title: string
          message: string
          severity: 'low' | 'medium' | 'high'
          status: 'new' | 'acknowledged' | 'resolved'
          timestamp: string
          site: string | null
          topic_id: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          type?: string
          title: string
          message: string
          severity?: 'low' | 'medium' | 'high'
          status?: 'new' | 'acknowledged' | 'resolved'
          timestamp?: string
          site?: string | null
          topic_id?: string | null
        }
        Update: {
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
        Relationships: [
          {
            foreignKeyName: "notifications_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          }
        ]
      }
      topics: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          name: string
          description: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          name: string
          description?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          name?: string
          description?: string | null
        }
        Relationships: []
      }
      topic_subscriptions: {
        Row: {
          id: string
          created_at: string
          user_id: string
          topic_id: string
        }
        Insert: {
          id?: string
          created_at?: string
          user_id: string
          topic_id: string
        }
        Update: {
          id?: string
          created_at?: string
          user_id?: string
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "topic_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topic_subscriptions_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          }
        ]
      }
      comments: {
        Row: {
          id: string
          created_at: string
          notification_id: string
          user_id: string
          text: string
        }
        Insert: {
          id?: string
          created_at?: string
          notification_id: string
          user_id: string
          text: string
        }
        Update: {
          id?: string
          created_at?: string
          notification_id?: string
          user_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      onesignal_players: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          user_id: string
          player_id: string
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          user_id: string
          player_id: string
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          user_id?: string
          player_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "onesignal_players_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      monitored_sites: {
        Row: {
          id: string;
          name: string;
          url: string;
          country: string;
          created_at: string;
          updated_at: string;
          latitude: number | null;
          longitude: number | null;
        }
        Insert: {
          id?: string;
          name: string;
          url: string;
          country?: string;
          created_at?: string;
          updated_at?: string;
          latitude?: number | null;
          longitude?: number | null;
        }
        Update: {
          id?: string;
          name?: string;
          url?: string;
          country?: string;
          created_at?: string;
          updated_at?: string;
          latitude?: number | null;
          longitude?: number | null;
        }
        Relationships: []
      }
      ping_logs: {
        Row: {
            id: number;
            site_id: string;
            is_up: boolean;
            response_time_ms: number;
            status_code: number;
            status_text: string;
            checked_at: string;
        }
        Insert: {
            id?: number;
            site_id: string;
            is_up: boolean;
            response_time_ms: number;
            status_code: number;
            status_text: string;
            checked_at?: string;
        }
        Update: {
            id?: number;
            site_id?: string;
            is_up?: boolean;
            response_time_ms?: number;
            status_code?: number;
            status_text?: string;
            checked_at?: string;
        }
        Relationships: [
          {
            foreignKeyName: "ping_logs_site_id_fkey",
            columns: ["site_id"],
            isOneToOne: false,
            referencedRelation: "monitored_sites",
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
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
  user_email: string;
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
  resolvedAt?: string;
}

export type NotificationUpdatePayload = Database['public']['Tables']['notifications']['Update'];

export interface Topic {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  subscribed?: boolean;
  subscription_id?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  user: string;
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

export type { Session };

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

export type PingLog = Database['public']['Tables']['ping_logs']['Row'];

export interface Incident {
  reason: string;
  started_at: string;
  duration_human: string;
  is_resolved: boolean;
}

export type MonitoredSite = Database['public']['Tables']['monitored_sites']['Row'] & {
  status?: 'online' | 'offline' | 'unknown';
  ping_logs?: PingLog[];
  latest_ping?: PingLog;
  last_checked?: string;
  incidents?: Incident[];
};
