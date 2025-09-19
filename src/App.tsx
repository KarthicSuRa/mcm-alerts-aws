/// <reference types="vite/client" />

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { LandingPage } from './pages/LandingPage';
import { SupabaseLoginPage } from './pages/SupabaseLoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ApiDocsPage } from './pages/ApiDocsPage';
import { AuditLogsPage } from './pages/AuditLogsPage';
import { HowItWorksPage } from './pages/HowItWorksPage';
import { TopicManagerPage } from './pages/TopicManagerPage';
import { CalendarPage } from './pages/CalendarPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { SiteMonitoringPage } from './pages/SiteMonitoringPage';
import { Sidebar } from './components/layout/Sidebar';
import IntegrationPage from './pages/IntegrationPage';
import { SettingsModal } from './components/layout/SettingsModal';
import { NotificationToast } from './components/ui/NotificationToast';
import { Theme, type Notification, Severity, NotificationStatus, SystemStatusData, Session, Comment, NotificationUpdatePayload, Topic, Database, MonitoredSite } from './types';
import { supabase } from './lib/supabaseClient';
import { OneSignalService } from './lib/oneSignalService';
import { ThemeContext } from './contexts/ThemeContext';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { SiteDetailPage } from './pages/monitoring/SiteDetailPage';
import ErrorBoundary from './components/ui/ErrorBoundary';

type NotificationFromDB = Database['public']['Tables']['notifications']['Row'];
type CommentFromDB = Database['public']['Tables']['comments']['Row'];
type TopicFromDB = Database['public']['Tables']['topics']['Row'];
type SubscriptionFromDB = Database['public']['Tables']['topic_subscriptions']['Row'];

// Extended notification type to include OneSignal ID
interface ExtendedNotification extends Notification {
  oneSignalId?: string;
}

function App() {
  const [theme, setTheme] = useState<Theme>('light');
  const [session, setSession] = useState<Session | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [unauthedPage, setUnauthedPage] = useState<'landing' | 'login'>('landing');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [snoozedUntil, setSnoozedUntil] = useState<Date | null>(null);
  const [isPushEnabled, setIsPushEnabled] = useState(false);
  const [isPushLoading, setIsPushLoading] = useState(false);
  const [notifications, setNotifications] = useState<ExtendedNotification[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [toasts, setToasts] = useState<ExtendedNotification[]>([]);
  const [authLoading, setAuthLoading] = useState(true);
  const [sites, setSites] = useState<MonitoredSite[]>([]);
  const [loadingSites, setLoadingSites] = useState(true);
  const [sitesError, setSitesError] = useState<string | null>(null);

  const navigate = useNavigate();
  const location = useLocation();

  const oneSignalService = OneSignalService.getInstance();
  const oneSignalInitialized = useRef(false);
  const dataFetched = useRef(false);
  const realtimeSubscriptions = useRef<Map<string, any>>(new Map());
  const initializationInProgress = useRef(false);
  const pendingUpdates = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const visibilityChangeHandler = useRef<(() => void) | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const lastActivity = useRef(Date.now());

  const currentPage = useMemo(() => {
    const path = location.pathname;
    if (path.startsWith('/site-monitoring') || path.startsWith('/monitoring')) return 'site-monitoring';
    if (path.startsWith('/api-docs')) return 'api-docs';
    if (path.startsWith('/audit-logs')) return 'audit-logs';
    if (path.startsWith('/how-it-works')) return 'how-it-works';
    if (path.startsWith('/calendar')) return 'calendar';
    if (path.startsWith('/analytics')) return 'analytics';
    if (path.startsWith('/topic-manager')) return 'topic-manager';
    if (path.startsWith('/integrations')) return 'integrations';
    return 'dashboard';
  }, [location.pathname]);

  const addToast = useCallback((notification: ExtendedNotification) => {
    console.log('🍞 Adding toast notification:', notification.title);
    setToasts(prev => [{...notification}, ...prev]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const systemStatus: SystemStatusData = useMemo(() => ({
    status: 'operational',
    message: 'All systems normal',
    last_updated: new Date().toISOString(),
    service: 'Ready',
    database: 'Connected',
    push: 'OneSignal',
    subscription: isPushEnabled ? 'Active' : 'Inactive',
  }), [isPushEnabled]);

  const forceRefreshNotifications = useCallback(async () => {
    if (!session) return;
    
    console.log('🔄 Force refreshing notifications...');
    
    dataFetched.current = false;
    
    try {
      const { data: notificationsData, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Error force refreshing notifications:', error);
        alert(`Database error: ${error.message}`);
        return;
      }

      if (notificationsData) {
        const notificationIds = notificationsData.map(n => n.id);
        const commentsByNotificationId = new Map<string, CommentFromDB[]>();

        if (notificationIds.length > 0) {
          const { data: commentsData, error: commentsError } = await supabase
            .from('comments')
            .select('*')
            .in('notification_id', notificationIds);

          if (commentsData && !commentsError) {
            commentsData.forEach(c => {
              if (!commentsByNotificationId.has(c.notification_id)) {
                commentsByNotificationId.set(c.notification_id, []);
              }
              commentsByNotificationId.get(c.notification_id)!.push(c);
            });
          }
        }

        const transformedData = notificationsData.map(n => {
          const comments = commentsByNotificationId.get(n.id) || [];
          return {
            ...n,
            comments: comments.map((c: CommentFromDB) => ({
              ...c,
              user_email: c.user_id === session.user.id ? (session.user.email ?? 'Current User') : 'Another User'
            }))
          };
        });
        
        setNotifications(transformedData as ExtendedNotification[]);
        console.log('✅ Notifications force refreshed successfully:', transformedData.length);
        
        dataFetched.current = true;
        
        // After refresh, ensure realtime subscriptions are active
        setTimeout(() => {
          if (session && dataFetched.current) {
            const hasActiveSubscriptions = Array.from(realtimeSubscriptions.current.values()).some(
              channel => channel.state === 'joined' || channel.state === 'joining'
            );
            
            if (!hasActiveSubscriptions) {
              console.log('📱 No active subscriptions after refresh - reconnecting...');
              setupRealtimeSubscriptions();
            }
          }
        }, 2000);
      }
    } catch (error) {
      console.error('Error in force refresh:', error);
      alert('Failed to refresh notifications. Please try again.');
    }
  }, [session]);

  // Setup realtime subscriptions function - needs to be accessible by mobile handlers
  const setupRealtimeSubscriptions = useCallback(() => {
    if (!session || !dataFetched.current) {
      console.log('⏸️ Skipping realtime setup - not ready');
      return;
    }

    console.log('🔗 Setting up realtime subscriptions...');

    // Clean up existing subscriptions
    realtimeSubscriptions.current.forEach(channel => {
      try {
        if (channel.state !== 'closed') {
          channel.unsubscribe();
        }
      } catch (error) {
        console.warn('⚠️ Error cleaning up old channel:', error);
      }
    });
    realtimeSubscriptions.current.clear();

    // Notifications channel with enhanced mobile configuration
    const notificationChannel = supabase
      .channel('notifications-global', {
        config: {
          presence: { key: `user-${session.user.id}` }
        }
      })
      .on<NotificationFromDB>('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'notifications' 
      }, async (payload) => {
        console.log('🔵 New notification received via realtime:', {
          id: payload.new.id,
          title: payload.new.title,
          topic_id: payload.new.topic_id
        });
        
        const newNotification = {...payload.new, comments: [] } as ExtendedNotification;
        
        setNotifications(prev => {
          // Check for duplicates by ID or OneSignal ID
          const exists = prev.some(n => 
            n.id === newNotification.id || 
            (n.oneSignalId && newNotification.oneSignalId && n.oneSignalId === newNotification.oneSignalId)
          );
          
          if (exists) {
            console.log('🔄 Notification already exists, skipping INSERT');
            return prev;
          }
          console.log('➕ Adding new notification to list');
          return [newNotification, ...prev];
        });
        
        // Handle new notification with slight delay
        setTimeout(() => {
          handleNewNotification(newNotification);
        }, 200);
      })
      .on<NotificationFromDB>('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'notifications' 
      }, payload => {
        console.log('🟡 Notification UPDATE received via realtime:', {
          id: payload.new.id,
          oldStatus: payload.old?.status,
          newStatus: payload.new.status
        });
        
        // Only apply realtime updates if we don't have a pending local update
        if (!pendingUpdates.current.has(payload.new.id)) {
          setNotifications(prev => prev.map(n => {
            if (n.id === payload.new.id) {
              console.log('🟢 Applying realtime update to notification:', n.id);
              return {
                ...n,
                ...payload.new,
                comments: n.comments || [],
                updated_at: payload.new.updated_at || new Date().toISOString()
              } as ExtendedNotification;
            }
            return n;
          }));
        } else {
          console.log('⏸️ Skipping realtime update - local update pending for:', payload.new.id);
        }
      })
      .on('system', { event: '*' }, (payload) => {
        console.log('📱 System event:', payload);
        if (payload.event === 'phx_error' || payload.status === 'error') {
          console.log('❌ Realtime connection error detected - will attempt reconnect');
          // Don't immediately reconnect, let the health check handle it
        }
      })
      .subscribe((status, err) => {
        if (err) {
          console.error('❌ Notification channel subscription error:', err);
          // Reset reconnect attempts on error
          reconnectAttempts.current = 0;
        } else {
          console.log('✅ Notification channel status:', status);
          if (status === 'SUBSCRIBED') {
            reconnectAttempts.current = 0; // Reset on successful connection
          }
        }
      });

    realtimeSubscriptions.current.set('notifications', notificationChannel);

    // Comments channel with enhanced mobile configuration
    const commentsChannel = supabase
    .channel(`comments-${session.user.id}`, {
      config: {
        broadcast: { self: true },
        presence: { key: session.user.id }
      }
    })
    .on<CommentFromDB>('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'comments'
    }, async (payload) => {
      console.log('💬 New comment received via realtime:', payload.new);
      const newCommentPayload = payload.new;
      const newComment = {
        ...newCommentPayload,
        user_email: newCommentPayload.user_id === session.user.id ?
          (session.user.email ?? 'Current User') : 'Another User'
      } as Comment;

      setNotifications(prev => {
        const notification = prev.find(n => n.id === newComment.notification_id);

        // If the comment already exists in the state, don't add it again.
        if (notification && notification.comments.some(c => c.id === newComment.id)) {
          return prev;
        }
        
        return prev.map(n =>
          n.id === newComment.notification_id
            ? {
              ...n,
              comments: [...(n.comments || []), newComment]
                .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
            }
            : n
        );
      });
    })
      .on('system', { event: '*' }, (payload) => {
        if (payload.event === 'phx_error' || payload.status === 'error') {
          console.log('❌ Comments channel error detected');
        }
      })
      .subscribe((status, err) => {
        if (err) {
          console.error('❌ Comments channel subscription error:', err);
        } else {
          console.log('✅ Comments channel status:', status);
        }
      });

    realtimeSubscriptions.current.set('comments', commentsChannel);

    // Topics channel with enhanced mobile configuration
    const topicChannel = supabase
      .channel(`topics-${session.user.id}`, {
        config: {
          broadcast: { self: false },
          presence: { key: session.user.id }
        }
      })
      .on<TopicFromDB>('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'topics' 
      }, payload => {
        console.log('📂 New topic received:', payload.new);
        setTopics(prev => [...prev, {...payload.new, subscribed: false} as Topic]);
      })
      .on('system', { event: '*' }, (payload) => {
        if (payload.event === 'phx_error' || payload.status === 'error') {
          console.log('❌ Topics channel error detected');
        }
      })
      .subscribe((status, err) => {
        if (err) {
          console.error('❌ Topics channel subscription error:', err);
        } else {
          console.log('✅ Topics channel status:', status);
        }
      });

    realtimeSubscriptions.current.set('topics', topicChannel);

    // Subscriptions channel with enhanced mobile configuration
    const subscriptionChannel = supabase
      .channel(`subscriptions-${session.user.id}`, {
        config: {
          broadcast: { self: false },
          presence: { key: session.user.id }
        }
      })
      .on<SubscriptionFromDB>('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'topic_subscriptions', 
        filter: `user_id=eq.${session.user.id}` 
      }, (payload) => {
        console.log('🔄 Subscription change:', payload);
        
        if (payload.eventType === 'INSERT') {
          const newSub = payload.new as SubscriptionFromDB;
          setTopics(prev => prev.map(t => 
            t.id === newSub.topic_id ? {...t, subscribed: true, subscription_id: newSub.id} : t
          ));
        }
        if (payload.eventType === 'DELETE') {
          const oldSub = payload.old as Partial<SubscriptionFromDB>;
          if (oldSub?.topic_id) {
            setTopics(prev => prev.map(t => 
              t.id === oldSub.topic_id ? {...t, subscribed: false, subscription_id: undefined} : t
            ));
          }
        }
      })
      .on('system', { event: '*' }, (payload) => {
        if (payload.event === 'phx_error' || payload.status === 'error') {
          console.log('❌ Subscriptions channel error detected');
        }
      })
      .subscribe((status, err) => {
        if (err) {
          console.error('❌ Subscriptions channel subscription error:', err);
        } else {
          console.log('✅ Subscriptions channel status:', status);
        }
      });

    realtimeSubscriptions.current.set('subscriptions', subscriptionChannel);
    
    console.log('✅ All realtime subscriptions set up successfully');
  }, [session]);

  // Mobile-specific: Handle visibility changes and reconnection
  useEffect(() => {
    const handleVisibilityChange = () => {
      lastActivity.current = Date.now();
      
      if (document.visibilityState === 'visible' && session) {
        console.log('📱 App became visible - checking realtime connections...');
        
        // Small delay to ensure the app is fully active
        setTimeout(() => {
          if (session && dataFetched.current) {
            // Check if realtime subscriptions are still active
            const hasActiveSubscriptions = Array.from(realtimeSubscriptions.current.values()).some(
              channel => channel.state === 'joined' || channel.state === 'joining'
            );
            
            if (!hasActiveSubscriptions) {
              console.log('📱 No active realtime subscriptions found - reconnecting...');
              setupRealtimeSubscriptions();
            }
            
            // Force refresh notifications if it's been a while
            const timeSinceLastActivity = Date.now() - lastActivity.current;
            if (timeSinceLastActivity > 30000) { // 30 seconds
              console.log('📱 App was inactive for a while - refreshing notifications...');
              forceRefreshNotifications();
            }
          }
        }, 1000);
      } else if (document.visibilityState === 'hidden') {
        console.log('📱 App became hidden - recording timestamp');
        lastActivity.current = Date.now();
      }
    };

    const handleFocus = () => {
      console.log('📱 Window focused - ensuring realtime connections...');
      lastActivity.current = Date.now();
      
      if (session && dataFetched.current) {
        setTimeout(() => {
          const hasActiveSubscriptions = Array.from(realtimeSubscriptions.current.values()).some(
            channel => channel.state === 'joined' || channel.state === 'joining'
          );
          
          if (!hasActiveSubscriptions) {
            console.log('📱 Reconnecting realtime subscriptions on focus...');
            setupRealtimeSubscriptions();
          }
        }, 500);
      }
    };

    const handleOnline = () => {
      console.log('📱 Network connection restored - reconnecting...');
      if (session && dataFetched.current) {
        setTimeout(() => {
          setupRealtimeSubscriptions();
          forceRefreshNotifications();
        }, 1000);
      }
    };

    // Add event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleOnline);
    
    visibilityChangeHandler.current = handleVisibilityChange;

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleOnline);
      visibilityChangeHandler.current = null;
    };
  }, [session, forceRefreshNotifications, setupRealtimeSubscriptions]);

  // Mobile-specific: Periodic connection health check
  useEffect(() => {
    if (!session || !dataFetched.current) return;

    const healthCheckInterval = setInterval(() => {
      // Only run health check if app is visible
      if (document.visibilityState === 'visible') {
        const activeChannels = Array.from(realtimeSubscriptions.current.values()).filter(
          channel => channel.state === 'joined'
        );
        
        console.log(`🔍 Health check: ${activeChannels.length}/${realtimeSubscriptions.current.size} channels active`);
        
        // If we have no active channels but should have them, reconnect
        if (activeChannels.length === 0 && realtimeSubscriptions.current.size > 0) {
          console.log('⚠️ No active realtime channels detected - attempting reconnect...');
          if (reconnectAttempts.current < maxReconnectAttempts) {
            reconnectAttempts.current++;
            setupRealtimeSubscriptions();
          } else {
            console.log('🚨 Max reconnect attempts reached - forcing full refresh...');
            reconnectAttempts.current = 0;
            forceRefreshNotifications();
          }
        } else if (activeChannels.length > 0) {
          // Reset reconnect attempts on successful connection
          reconnectAttempts.current = 0;
        }
      }
    }, 15000); // Check every 15 seconds

    return () => clearInterval(healthCheckInterval);
  }, [session, forceRefreshNotifications, setupRealtimeSubscriptions]);

  // Auth Effect - Simplified and optimized
  useEffect(() => {
    let mounted = true;
    
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (mounted) {
          setSession(session);
          setAuthLoading(false);
          console.log('🔐 Auth session initialized:', !!session);
        }
      } catch (error) {
        console.error('❌ Error getting auth session:', error);
        if (mounted) {
          setAuthLoading(false);
        }
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        console.log('🔐 Auth state changed:', !!session);
        setSession(session);
        setAuthLoading(false);
        
        if (!session) {
          // Reset all state when user logs out
          dataFetched.current = false;
          oneSignalInitialized.current = false;
          initializationInProgress.current = false;
          setNotifications([]);
          setTopics([]);
          setToasts([]);
          setIsPushEnabled(false);
          setIsPushLoading(false);
          
          // Clear pending updates
          pendingUpdates.current.forEach(timeout => clearTimeout(timeout));
          pendingUpdates.current.clear();
          
          console.log('🧹 Clearing realtime subscriptions due to auth change');
          realtimeSubscriptions.current.forEach(channel => {
            try {
              channel.unsubscribe();
            } catch (error) {
              console.warn('Error unsubscribing from channel:', error);
            }
          });
          realtimeSubscriptions.current.clear();
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
      // Clear any pending timeouts
      pendingUpdates.current.forEach(timeout => clearTimeout(timeout));
      pendingUpdates.current.clear();
    };
  }, []);

  const mapOneSignalSeverity = useCallback((notification: any): Severity => {
    if (notification.data?.severity) {
      const severity = notification.data.severity.toLowerCase();
      if (['low', 'medium', 'high'].includes(severity)) {
        return severity as Severity;
      }
    }
    
    switch (notification.priority) {
      case 10: return 'high';
      case 5: return 'medium';
      default: return 'medium';
    }
  }, []);

  const handleNewNotification = useCallback(async (notification: ExtendedNotification) => {
    console.log('🔔 Handling new notification:', {
      id: notification.id,
      title: notification.title,
      severity: notification.severity,
      topic_id: notification.topic_id,
      snoozedUntil: !!snoozedUntil,
      soundEnabled
    });

    if (snoozedUntil && new Date() < snoozedUntil) {
      console.log("⏰ Alerts are snoozed. Notification sound/toast blocked.");
      return;
    }

    if (notification.topic_id) {
      if (topics.length === 0) {
        console.log("📂 Topics not loaded yet, waiting...");
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      const notificationTopic = topics.find(t => t.id === notification.topic_id);
      if (notificationTopic && !notificationTopic.subscribed) {
        console.log("📵 User not subscribed to this topic. Notification sound/toast blocked.", {
          topicId: notification.topic_id,
          topicName: notificationTopic.name,
          subscribed: notificationTopic.subscribed
        });
        return;
      } else if (!notificationTopic) {
        console.log("📂 Topic not found, but allowing notification (might be new topic)");
      }
    } else {
      console.log("📢 General notification (no topic) - showing to all users");
    }

    const toastNotification = {
      ...notification,
      id: `toast-${notification.id}-${Date.now()}`
    };
    addToast(toastNotification);

    if (soundEnabled) {
      try {
        console.log('🔊 Playing notification sound');
        const audio = new Audio('/alert.wav');
        audio.volume = 0.7;
        await audio.play();
        console.log('✅ Notification sound played successfully');
      } catch (error) {
        console.error("❌ Error playing sound:", error);
      }
    }
  }, [soundEnabled, snoozedUntil, topics, addToast]);

  // In src/App.tsx

  // OneSignal Initialization - Handles login and state persistence
  useEffect(() => {
    if (!session || authLoading) {
      return;
    }
    
    // This flag prevents re-initialization within the same session
    if (oneSignalInitialized.current) {
        return;
    }

    const initOneSignal = async () => {
      if (initializationInProgress.current) return;

      try {
        initializationInProgress.current = true;
        setIsPushLoading(true);
        console.log('🔔 Initializing OneSignal...');
        
        await oneSignalService.initialize();

        // --- FIX: Log user into OneSignal for persistence ---
        try {
          console.log(`🔔 Logging into OneSignal with external user ID: ${session.user.id}`);
          await oneSignalService.login(session.user.id);
        } catch (error) {
           console.error('❌ OneSignal login failed:', error);
           // Non-fatal, proceed with initialization
        }
        
        const isSubscribed = await oneSignalService.isSubscribed();
        console.log('🔔 OneSignal subscription status on load:', isSubscribed);
        setIsPushEnabled(isSubscribed);
        
        oneSignalService.onSubscriptionChange((subscribed: boolean) => {
          console.log('🔔 OneSignal subscription changed:', subscribed);
          setIsPushEnabled(subscribed);
        });

        // The setup for foreground notifications is now more robust.
        // I've passed the handleNewNotification callback directly.
        oneSignalService.setupForegroundNotifications(handleNewNotification);
        
        oneSignalInitialized.current = true;
        console.log('✅ OneSignal initialization completed');

      } catch (error) {
        console.error('❌ Failed to initialize OneSignal:', error);
      } finally {
        setIsPushLoading(false);
        initializationInProgress.current = false;
      }
    };

    initOneSignal();

  }, [session, authLoading, oneSignalService, handleNewNotification]);


  const updateNotification = useCallback(async (notificationId: string, updates: NotificationUpdatePayload) => {
    console.log('🔧 Updating notification:', { notificationId, updates });
    
    const originalNotification = notifications.find(n => n.id === notificationId);
    if (!originalNotification) {
      console.error('❌ Original notification not found for update');
      return;
    }
    
    // Cancel any pending update for this notification
    const existingTimeout = pendingUpdates.current.get(notificationId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      pendingUpdates.current.delete(notificationId);
    }
    
    // Optimistic update
    setNotifications(prev => prev.map(n => {
      if (n.id === notificationId) {
        console.log('⚡ Optimistic update applied:', { 
          id: notificationId, 
          oldStatus: n.status, 
          newStatus: updates.status 
        });
        return {
          ...n,
          ...updates,
          updated_at: new Date().toISOString(),
          comments: n.comments || []
        } as ExtendedNotification;
      }
      return n;
    }));
    
    // Debounce database updates
    const updateTimeout = setTimeout(async () => {
      try {
        console.log('🔧 Executing database update for notification:', notificationId);
        
        // Verify notification exists before updating
        const { data: existingNotification, error: checkError } = await supabase
          .from('notifications')
          .select('id')
          .eq('id', notificationId)
          .single();
        
        if (checkError) {
          if (checkError.code === 'PGRST116') {
            console.error('❌ Notification not found in database:', notificationId);
            // Revert optimistic update
            setNotifications(prev => prev.map(n => {
              if (n.id === notificationId) {
                return originalNotification;
              }
              return n;
            }));
            return;
          }
          throw checkError;
        }
        
        if (!existingNotification) {
          console.error('❌ Notification does not exist in database:', notificationId);
          // Revert optimistic update
          setNotifications(prev => prev.map(n => {
            if (n.id === notificationId) {
              return originalNotification;
            }
            return n;
          }));
          return;
        }
        
        const { error, data } = await supabase
          .from('notifications')
          .update({
            ...updates,
            updated_at: new Date().toISOString()
          })
          .eq('id', notificationId)
          .select()
          .single();
        
        if (error) {
          console.error("❌ Database update failed, reverting optimistic update:", error);
          
          // Revert optimistic update
          setNotifications(prev => prev.map(n => {
            if (n.id === notificationId) {
              return originalNotification;
            }
            return n;
          }));
          
          throw error;
        }
        
        console.log('✅ Database update successful:', data);
        
      } catch (error) {
        console.error("❌ Failed to update notification:", error);
        throw error;
      } finally {
        pendingUpdates.current.delete(notificationId);
      }
    }, 500); // 500ms debounce
    
    pendingUpdates.current.set(notificationId, updateTimeout);
  }, [notifications]);

  // Data Fetching and Realtime Subscriptions - Only when session exists
  useEffect(() => {
    if (!session || dataFetched.current || authLoading) {
      return;
    }
    
    let mounted = true;
    
    const fetchInitialData = async () => {
      try {
        console.log('📊 Fetching initial data for user:', session.user.id);
        
        // Fetch notifications
        const { data: notificationsData, error: notificationsError } = await supabase
          .from('notifications')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100);

        if (notificationsError) {
          console.error('❌ Error fetching notifications:', notificationsError);
          throw notificationsError;
        }

        if (notificationsData && mounted) {
          const notificationIds = notificationsData.map(n => n.id);
          const commentsByNotificationId = new Map<string, CommentFromDB[]>();

          // Fetch comments for notifications
          if (notificationIds.length > 0) {
            const { data: commentsData, error: commentsError } = await supabase
              .from('comments')
              .select('*')
              .in('notification_id', notificationIds)
              .order('created_at', { ascending: true });

            if (commentsData && !commentsError) {
              commentsData.forEach(c => {
                if (!commentsByNotificationId.has(c.notification_id)) {
                  commentsByNotificationId.set(c.notification_id, []);
                }
                commentsByNotificationId.get(c.notification_id)!.push(c);
              });
            } else if (commentsError) {
              console.error('⚠️ Error fetching comments:', commentsError);
            }
          }

          const transformedData = notificationsData.map(n => {
            const comments = commentsByNotificationId.get(n.id) || [];
            return {
              ...n,
              comments: comments.map((c: CommentFromDB) => ({
                ...c,
                user_email: c.user_id === session.user.id ? (session.user.email ?? 'Current User') : 'Another User'
              }))
            };
          });
          
          console.log('✅ Notifications fetched:', transformedData.length);
          setNotifications(transformedData as ExtendedNotification[]);
        } else {
          console.log('📭 No notifications found');
          setNotifications([]);
        }

        // Fetch topics and subscriptions
        const [topicsResult, subscriptionsResult] = await Promise.all([
          supabase.from('topics').select('*').order('name'),
          supabase.from('topic_subscriptions').select('*').eq('user_id', session.user.id)
        ]);

        if (topicsResult.error) {
          console.error('❌ Error fetching topics:', topicsResult.error);
          throw topicsResult.error;
        }

        if (subscriptionsResult.error) {
          console.error('❌ Error fetching subscriptions:', subscriptionsResult.error);
          throw subscriptionsResult.error;
        }

        if (topicsResult.data && subscriptionsResult.data && mounted) {
          const subscribedTopicIds = new Set(subscriptionsResult.data.map(sub => sub.topic_id));
          const mergedTopics = topicsResult.data.map(topic => ({
            ...topic,
            subscribed: subscribedTopicIds.has(topic.id),
            subscription_id: subscriptionsResult.data.find(s => s.topic_id === topic.id)?.id,
          }));
          console.log('✅ Topics fetched:', mergedTopics.length, 'subscriptions:', subscribedTopicIds.size);
          setTopics(mergedTopics);
        }
        
        dataFetched.current = true;
        console.log('✅ Initial data fetch completed successfully');

      } catch (error) {
        console.error('❌ Error in fetchInitialData:', error);
        dataFetched.current = false;
        
        if (mounted) {
          setNotifications([]);
          setTopics([]);
        }
      }
    };

    // Start data fetching, then setup realtime
    fetchInitialData()
      .then(() => {
        if (mounted && dataFetched.current) {
          // Setup realtime with slight delay
          setTimeout(() => {
            if (mounted) {
              setupRealtimeSubscriptions();
            }
          }, 1000);
        }
      })
      .catch(error => {
        console.error('❌ Failed to fetch initial data:', error);
      });

    return () => {
      console.log('🧹 Cleaning up data fetching effect...');
      mounted = false;
      
      // Clear pending updates
      pendingUpdates.current.forEach(timeout => clearTimeout(timeout));
      pendingUpdates.current.clear();
      
      // Cleanup realtime subscriptions
      const cleanup = async () => {
        const channelPromises = Array.from(realtimeSubscriptions.current.values()).map(async (channel) => {
          try {
            if (channel && channel.state !== 'closed') {
              await channel.unsubscribe();
              await supabase.removeChannel(channel);
            }
          } catch (error) {
            console.warn('⚠️ Error cleaning up channel:', error);
          }
        });
        
        try {
          await Promise.allSettled(channelPromises);
          realtimeSubscriptions.current.clear();
        } catch (error) {
          console.warn('⚠️ Some channels failed to cleanup properly:', error);
        }
      };
      
      cleanup();
    };
  }, [session, authLoading, handleNewNotification, setupRealtimeSubscriptions]);

  // Fetch Monitored Sites
  useEffect(() => {
    if (!session) return;

    const fetchSites = async () => {
      setLoadingSites(true);
      setSitesError(null);
      try {
        const { data, error } = await supabase
          .from('monitored_sites')
          .select('*');

        if (error) {
          throw error;
        }
        setSites(data || []);
      } catch (error: any) {
        console.error('Error fetching monitored sites:', error);
        setSitesError('Failed to load site data.');
      } finally {
        setLoadingSites(false);
      }
    };

    fetchSites();
  }, [session]);
  useEffect(() => {
    if (!session) return;

    const sitesSubscription = supabase
      .channel('public:monitored_sites')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'monitored_sites' },
        (payload) => {
          console.log('Site change received!', payload);
          if (payload.eventType === 'INSERT') {
            setSites(currentSites => [...currentSites, payload.new as MonitoredSite]);
          }
          if (payload.eventType === 'UPDATE') {
            setSites(currentSites =>
              currentSites.map(site =>
                site.id === payload.new.id ? (payload.new as MonitoredSite) : site
              )
            );
          }
          if (payload.eventType === 'DELETE') {
            setSites(currentSites =>
              currentSites.filter(site => site.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sitesSubscription);
    };
  }, [session]);
  const subscribeToPush = useCallback(async () => {
    if (!session) return;
    setIsPushLoading(true);

    try {
      console.log('🔔 Starting push subscription process...');
      
      const playerId = await oneSignalService.subscribe();
      if (!playerId) {
        throw new Error('Failed to get player ID from OneSignal');
      }
      
      console.log('🔔 OneSignal subscription successful, player ID:', playerId);
      
      await oneSignalService.savePlayerIdToDatabase(session.user.id);
      console.log('🔔 Player ID saved to database');
      
      // Wait for registration to complete
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const subscribedTopics = topics.filter(t => t.subscribed);
      if (subscribedTopics.length > 0) {
        console.log('🔔 Setting tags for subscribed topics:', subscribedTopics.map(t => t.name));
        
        try {
          const tags: Record<string, string> = {};
          subscribedTopics.forEach(topic => {
            tags[`topic_${topic.id}`] = '1';
          });
          
          console.log('🔔 Tags to set:', tags);
          await oneSignalService.setUserTags(tags);
          console.log('🔔 Tags set successfully');
        } catch (tagError) {
          console.error('🔔 Failed to set tags (non-critical):', tagError);
        }
      }
      
      setIsPushEnabled(true);
      console.log('🔔 Push notifications enabled successfully');
      
    } catch (error) {
      console.error('🔔 Failed to subscribe to push notifications:', error);
      
      let errorMessage = 'Failed to enable push notifications. ';
      if (error instanceof Error) {
        if (error.message.includes('permission')) {
          errorMessage += 'Please allow notifications in your browser.';
        } else if (error.message.includes('player ID')) {
          errorMessage += 'OneSignal registration failed. Please try again.';
        } else if (error.message.includes('not supported')) {
          errorMessage += 'Your browser does not support push notifications.';
        } else {
          errorMessage += 'Please try again or check your browser settings.';
        }
      }
      
      alert(errorMessage);
    } finally {
      setIsPushLoading(false);
    }
  }, [session, topics]);
  
  const unsubscribeFromPush = useCallback(async () => {
    if (!session) return;
    setIsPushLoading(true);
    
    try {
      await oneSignalService.unsubscribe();
      await oneSignalService.removePlayerIdFromDatabase(session.user.id);
      setIsPushEnabled(false);
    } catch (error) {
      console.error('Failed to unsubscribe from push:', error);
    } finally {
      setIsPushLoading(false);
    }
  }, [session]);

  // Theme effect
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);
  
  const handleUnauthedNavigate = useCallback((page: 'landing' | 'login') => {
    setUnauthedPage(page);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
  }, []);

  // In src/App.tsx

  const handleLogout = useCallback(async () => {
    console.log('➡️ Starting logout process...');
    
    try {
      // --- FIX: Log user out of OneSignal ---
      // This disassociates the user from the device, ensuring the next
      // user to log in doesn't receive their push notifications.
      await oneSignalService.logout();
      console.log('🔔 Logged out from OneSignal');
    } catch (error) {
      console.error('❌ Error logging out from OneSignal (non-fatal):', error);
    }
    
    // Sign out from Supabase
    await supabase.auth.signOut();

    // Reset all application state
    setUnauthedPage('landing');
    dataFetched.current = false;
    oneSignalInitialized.current = false;

  }, [oneSignalService]); // Dependencies are now cleaner


  const handleNavigate = useCallback((page: string) => {
    if (session) {
      navigate(`/${page}`); // Use navigate to change the URL
    }
    setIsSidebarOpen(false);
  }, [session, navigate]);
  
  const sendTestAlert = useCallback(async () => {
    if (snoozedUntil && new Date() < snoozedUntil) {
      console.log("Alerts are snoozed. Test alert blocked.");
      alert("Alerts are currently snoozed. Please unsnooze to send test alerts.");
      return;
    }

    const subscribedTopics = topics.filter(t => t.subscribed);
    let topicId: string | null = null;
    let topicName: string = '';

    if (subscribedTopics.length > 0) {
      const randomTopic = subscribedTopics[Math.floor(Math.random() * subscribedTopics.length)];
      topicId = randomTopic.id;
      topicName = ` (${randomTopic.name})`;
    } else {
      console.log("No subscribed topics, sending general alert");
    }

    console.log('🧪 Sending test alert...');
    
    const newAlert: Database['public']['Tables']['notifications']['Insert'] = {
      type: 'server_alert',
      title: `Test Alert: High Priority${topicName}`,
      message: 'This is a test push notification from MCM Alerts.',
      severity: 'high',
      status: 'new',
      timestamp: new Date().toISOString(),
      site: 'prod-web-01',
      topic_id: topicId,
    };
    
    try {
      const { error } = await supabase.functions.invoke('hyper-worker', {
        body: newAlert,
      });
      
      if (error) {
        console.error("❌ Error sending test alert:", error);
        alert(`Failed to send test alert: ${error.message}`);
      } else {
        console.log('✅ Test alert sent successfully');
      }
    } catch (error) {
      console.error("❌ Error sending test alert:", error);
      alert('Failed to send test alert. Please try again.');
    }
  }, [snoozedUntil, topics]);

  const addComment = useCallback(async (notificationId: string, text: string) => {
    if (!session) {
      throw new Error('No session available');
    }

    console.log('💬 Inserting comment into database:', { notificationId, text });

    try {
      // The insert call will trigger the realtime subscription, which updates the UI.
      // We no longer need to manually update the state here, which avoids the race condition.
      const { error, data } = await supabase
        .from('comments')
        .insert([{
          notification_id: notificationId,
          text: text.trim(),
          user_id: session.user.id
        }])
        .select('id') // Only select the ID, as the rest is handled by the subscription
        .single();

      if (error) {
        console.error("❌ Error adding comment:", error);
        alert(`Failed to add comment: ${error.message}`);
        throw error;
      }

      console.log('✅ Comment inserted successfully:', data.id);
    } catch (error) {
      console.error("❌ Failed to add comment:", error);
      // Re-throw to allow component-level error handling if needed
      throw error;
    }
  }, [session]);

  const handleAddTopic = useCallback(async (name: string, description: string) => {
    try {
      const { error } = await supabase.from('topics').insert([{ name, description }]);
      if (error) {
        console.error("Error adding topic:", error);
        alert(`Failed to add topic: ${error.message}`);
      } else {
        console.log('✅ Topic added successfully');
      }
    } catch (error) {
      console.error("Error adding topic:", error);
      alert('Failed to add topic. Please try again.');
    }
  }, []);
  
  const handleToggleSubscription = useCallback(async (topic: Topic) => {
    if (!session) return;

    try {
      if (topic.subscribed && topic.subscription_id) {
        // --- Unsubscribe ---
        const { error } = await supabase.from('topic_subscriptions').delete().eq('id', topic.subscription_id);
        
        if (error) {
          console.error("Error unsubscribing:", error);
          alert(`Failed to unsubscribe: ${error.message}`);
          return;
        }
        
        console.log(`✅ Unsubscribed from ${topic.name}`);
        
        // --- FIX: Update local state on success ---
        setTopics(prev => prev.map(t => 
          t.id === topic.id ? { ...t, subscribed: false, subscription_id: undefined } : t
        ));

        // Update OneSignal tag (fire and forget)
        if (isPushEnabled) {
          oneSignalService.removeUserTags([`topic_${topic.id}`]).catch(e => console.warn('Failed to remove OneSignal tag', e));
        }

      } else {
        // --- Subscribe ---
        const { data, error } = await supabase
          .from('topic_subscriptions')
          .insert([{ user_id: session.user.id, topic_id: topic.id }])
          .select() // We need the new subscription ID
          .single();
          
        if (error) {
          console.error("Error subscribing:", error);
          alert(`Failed to subscribe: ${error.message}`);
          return;
        }

        console.log(`✅ Subscribed to ${topic.name}`);
        
        // --- FIX: Update local state on success ---
        setTopics(prev => prev.map(t => 
          t.id === topic.id ? { ...t, subscribed: true, subscription_id: data.id } : t
        ));
        
        // Update OneSignal tag (fire and forget)
        if (isPushEnabled) {
          oneSignalService.setUserTags({ [`topic_${topic.id}`]: '1' }).catch(e => console.warn('Failed to set OneSignal tag', e));
        }
      }
    } catch (error: any) {
      console.error('Error toggling subscription:', error);
      alert('Failed to update subscription. Please try again.');
    }
  }, [session, isPushEnabled]);


  const handleDeleteTopic = useCallback(async (topic: Topic) => {
    if (!session) return;
    try {
      // First delete subscriptions related to the topic to avoid foreign key issues
      await supabase.from('topic_subscriptions').delete().eq('topic_id', topic.id);

      // Then delete the topic itself
      const { error } = await supabase.from('topics').delete().eq('id', topic.id);
      if (error) {
        console.error("Error deleting topic:", error);
        alert(`Failed to delete topic: ${error.message}`);
      } else {
        console.log('✅ Topic deleted successfully');
        // Update the UI
        setTopics(prev => prev.filter(t => t.id !== topic.id));
      }
    } catch (error) {
      console.error('Error deleting topic:', error);
      alert('Failed to delete topic. Please try again.');
    }
  }, [session]);

  const handleClearLogs = useCallback(async () => {
    if (!session) return;
    try {
      console.log('🔥 Clearing all notifications...');
      
      // This will delete all notifications. Ensure you have cascading deletes
      // set up in your Supabase database for related comments, or delete them first.
      const { error } = await supabase
        .from('notifications')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Condition to delete all rows

      if (error) {
        console.error("❌ Error clearing notifications:", error);
        alert(`Failed to clear logs: ${error.message}`);
        return;
      }

      console.log('✅ All notifications cleared successfully');
      // Update the UI
      setNotifications([]);
      setToasts([]);

    } catch (error) {
      console.error("❌ Failed to clear logs:", error);
      alert('Failed to clear logs. Please try again.');
    }
  }, [session]);

  const themeContextValue = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme]);

  // Show loading while auth is initializing
  if (authLoading) {
    return (
      <ThemeContext.Provider value={themeContextValue}>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p>Loading...</p>
          </div>
        </div>
      </ThemeContext.Provider>
    );
  }

  if (!session) {
    return (
      <ThemeContext.Provider value={themeContextValue}>
        { unauthedPage === 'landing' 
          ? <LandingPage onNavigate={() => handleUnauthedNavigate('login')} />
          : <SupabaseLoginPage />
        }
      </ThemeContext.Provider>
    );
  }

  return (
    <ThemeContext.Provider value={themeContextValue}>
      <div className="min-h-screen font-sans text-foreground">
        <ErrorBoundary>
          <div className="h-screen flex">
            <Sidebar 
              currentPage={currentPage} 
              onNavigate={handleNavigate} 
              isSidebarOpen={isSidebarOpen} 
              setIsSidebarOpen={setIsSidebarOpen}
              onSendTestAlert={sendTestAlert}
              topics={topics}
            />
            <div className="flex-1 flex flex-col w-full">
              <Routes>
                <Route path="/monitoring/:id" element={
                  <SiteDetailPage
                    session={session}
                    onLogout={handleLogout}
                    openSettings={() => setIsSettingsOpen(true)}
                    isSidebarOpen={isSidebarOpen}
                    setIsSidebarOpen={setIsSidebarOpen}
                    notifications={notifications}
                    systemStatus={systemStatus}
                    onNavigate={handleNavigate}
                  />
                } />
                <Route path="/site-monitoring" element={
                  <SiteMonitoringPage
                    onLogout={handleLogout}
                    isSidebarOpen={isSidebarOpen}
                    setIsSidebarOpen={setIsSidebarOpen}
                    notifications={notifications}
                    openSettings={() => setIsSettingsOpen(true)}
                    systemStatus={systemStatus}
                    session={session}
                    onNavigate={handleNavigate}
                  />
                }/>
                <Route path="/api-docs" element={ 
                  <ApiDocsPage 
                    onLogout={handleLogout} 
                    onNavigate={handleNavigate} 
                    isSidebarOpen={isSidebarOpen} 
                    setIsSidebarOpen={setIsSidebarOpen} 
                    notifications={notifications} 
                    openSettings={() => setIsSettingsOpen(true)} 
                    systemStatus={systemStatus} 
                    session={session} 
                  /> 
                } />
                <Route path="/audit-logs" element={ 
                  <AuditLogsPage 
                    onLogout={handleLogout} 
                    onNavigate={handleNavigate} 
                    isSidebarOpen={isSidebarOpen} 
                    setIsSidebarOpen={setIsSidebarOpen} 
                    notifications={notifications} 
                    openSettings={() => setIsSettingsOpen(true)} 
                    systemStatus={systemStatus} 
                    session={session} 
                  /> 
                } />
                <Route path="/how-it-works" element={ 
                  <HowItWorksPage 
                    onLogout={handleLogout} 
                    onNavigate={handleNavigate} 
                    isSidebarOpen={isSidebarOpen} 
                    setIsSidebarOpen={setIsSidebarOpen} 
                    notifications={notifications} 
                    openSettings={() => setIsSettingsOpen(true)} 
                    systemStatus={systemStatus} 
                    session={session} 
                  /> 
                } />
                <Route path="/integrations" element={
                  <IntegrationPage
                    onLogout={handleLogout}
                    isSidebarOpen={isSidebarOpen}
                    setIsSidebarOpen={setIsSidebarOpen}
                    notifications={notifications}
                    openSettings={() => setIsSettingsOpen(true)}
                    systemStatus={systemStatus}
                    session={session}
                    onNavigate={handleNavigate}
                  />
                }/>
                <Route path="/calendar" element={ 
                  <CalendarPage 
                    onLogout={handleLogout} 
                    onNavigate={handleNavigate} 
                    isSidebarOpen={isSidebarOpen} 
                    setIsSidebarOpen={setIsSidebarOpen} 
                    notifications={notifications} 
                    openSettings={() => setIsSettingsOpen(true)} 
                    systemStatus={systemStatus} 
                    session={session} 
                  /> 
                } />
                <Route path="/analytics" element={ 
                  <AnalyticsPage 
                    onLogout={handleLogout} 
                    onNavigate={handleNavigate} 
                    isSidebarOpen={isSidebarOpen} 
                    setIsSidebarOpen={setIsSidebarOpen} 
                    notifications={notifications} 
                    openSettings={() => setIsSettingsOpen(true)} 
                    systemStatus={systemStatus} 
                    session={session} 
                    topics={topics} 
                  /> 
                } />
                <Route path="/topic-manager" element={
                  <TopicManagerPage
                    onLogout={handleLogout}
                    onNavigate={handleNavigate}
                    isSidebarOpen={isSidebarOpen}
                    setIsSidebarOpen={setIsSidebarOpen}
                    notifications={notifications}
                    openSettings={() => setIsSettingsOpen(true)}
                    systemStatus={systemStatus}
                    session={session}
                    topics={topics}
                    onAddTopic={handleAddTopic}
                    onToggleSubscription={handleToggleSubscription}
                    onDeleteTopic={handleDeleteTopic}
                  />
                }/>
                <Route path="*" element={
                  <DashboardPage
                    onLogout={handleLogout}
                    onNavigate={handleNavigate}
                    isSidebarOpen={isSidebarOpen}
                    setIsSidebarOpen={setIsSidebarOpen}
                    notifications={notifications}
                    openSettings={() => setIsSettingsOpen(true)}
                    systemStatus={systemStatus}
                    session={session}
                    topics={topics}
                    onUpdateNotification={updateNotification}
                    onAddComment={addComment}
                    sites={sites}
                    loadingSites={loadingSites}
                    sitesError={sitesError}
                    onClearLogs={handleClearLogs}
                  />
                }/>
              </Routes>
            </div>
          </div>

          <SettingsModal
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            soundEnabled={soundEnabled}
            setSoundEnabled={setSoundEnabled}
            snoozedUntil={snoozedUntil}
            setSnoozedUntil={setSnoozedUntil}
            isPushEnabled={isPushEnabled}
            isPushLoading={isPushLoading}
            onSubscribeToPush={subscribeToPush}
            onUnsubscribeFromPush={unsubscribeFromPush}
          />
        </ErrorBoundary>
      </div>
      
      {/* Toast Notifications */}
      <div aria-live="assertive" className="fixed inset-0 flex items-end px-4 py-6 pointer-events-none sm:p-6 sm:items-start z-[100]">
        <div className="w-full flex flex-col items-center space-y-4 sm:items-end">
          {toasts.map(toast => (
            <NotificationToast key={toast.id} notification={toast} onClose={() => removeToast(toast.id)} />
          ))}
        </div>
      </div>
    </ThemeContext.Provider>
  );
}

export default App;