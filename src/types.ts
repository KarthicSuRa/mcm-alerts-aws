

import { Session } from '@supabase/supabase-js';

export interface Database {
  public: {
    Tables: {
      notifications: {
        Row: {
          id: string
          created_at: string
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
          type: string
          title: string
          message: string
          severity: 'low' | 'medium' | 'high'
          status: 'new' | 'acknowledged' | 'resolved'
          timestamp: string
          site?: string | null
          topic_id?: string | null
        }
        Update: {
          type?: string
          title?: string
          message?: string
          severity?: 'low' | 'medium' | 'high'
          status?: 'new' | 'acknowledged' | 'resolved'
          timestamp?: string
          site?: string | null
          topic_id?: string | null
        }
        Relationships: []
      }
      comments: {
        Row: {
          id: string
          created_at: string
          text: string
          notification_id: string
          user_id: string
        }
        Insert: {
          text: string
          notification_id: string
          user_id: string
        }
        Update: {
          text?: string
          notification_id?: string
          user_id?: string
        }
        Relationships: []
      }
      topics: {
        Row: {
          id: string
          created_at: string
          name: string
          description: string
        }
        Insert: {
          name: string
          description: string
        }
        Update: {
          name?: string
          description?: string
        }
        Relationships: []
      }
      topic_subscriptions: {
        Row: {
          id: number
          created_at: string
          user_id: string
          topic_id: string
        }
        Insert: {
          user_id: string
          topic_id: string
        }
        Update: {
          user_id?: string
          topic_id?: string
        }
        Relationships: []
      },
      push_subscriptions: {
        Row: {
          id: number
          created_at: string
          user_id: string
          endpoint: string
          keys: { p256dh: string, auth: string }
        }
        Insert: {
          user_id: string
          endpoint: string
          keys: { p256dh: string, auth: string }
        }
        Update: {
          user_id?: string
          endpoint?: string
          keys?: { p256dh: string, auth: string }
        }
        Relationships: []
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
  id:string;
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
}

export type NotificationUpdatePayload = Database['public']['Tables']['notifications']['Update'];

export interface Topic {
  id: string;
  name: string;
  description: string;
  created_at: string;
  subscribed?: boolean;
  subscription_id?: number;
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
  service: 'Ready' | 'Error';
  database: 'Connected' | 'Disconnected';
  push: 'Supported' | 'Unsupported';
  subscription: 'Active' | 'Inactive';
}

export type { Session };
