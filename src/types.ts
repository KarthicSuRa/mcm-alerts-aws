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
