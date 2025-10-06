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
import { Theme, type Notification, Severity, NotificationStatus, SystemStatusData, Session, Comment, NotificationUpdatePayload, Topic, Database, MonitoredSite, ExtendedNotification } from './types';
import { supabase } from './lib/supabaseClient';
import { OneSignalService } from './lib/oneSignalService';
import { ThemeContext } from './contexts/ThemeContext';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { SiteDetailPage } from './pages/monitoring/SiteDetailPage';
import UserManagementPage from './pages/UserManagementPage';
import SyntheticTestRunner from './components/SyntheticTestRunner';
import ErrorBoundary from './components/ui/ErrorBoundary';
import { useServiceWorker } from './hooks/useServiceWorker';
import { setToastHandler } from './utils/toast';

type NotificationFromDB = Database['public']['Tables']['notifications']['Row'];
type CommentFromDB = Database['public']['Tables']['comments']['Row'];
type TopicFromDB = Database['public']['Tables']['topics']['Row'];
type SubscriptionFromDB = Database['public']['Tables']['topic_subscriptions']['Row'];
type Team = Database['public']['Tables']['teams']['Row'];

interface Profile {
  id: string;
  username?: string;
  avatar_url?: string;
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
  const [teams, setTeams] = useState<Team[]>([]);
  const [toasts, setToasts] = useState<ExtendedNotification[]>([]);
  const [authLoading, setAuthLoading] = useState(true);
  const [sites, setSites] = useState<MonitoredSite[]>([]);
  const [loadingSites, setLoadingSites] = useState(true);
  const [sitesError, setSitesError] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
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
  const oneSignalOperationInProgress = useRef(false);
  const tagsSetSuccessfully = useRef(false);
  
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

  useServiceWorker();

  useEffect(() => {
    setToastHandler(addToast);
    return () => {
      setToastHandler(() => {});
    };
  }, [addToast]);

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
    }
  }, [session]);

  const setupRealtimeSubscriptions = useCallback(() => {
    if (!session || !dataFetched.current) {
      console.log('⏸️ Skipping realtime setup - not ready');
      return;
    }

    console.log('🔗 Setting up realtime subscriptions...');

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

    const notificationChannel = supabase
      .channel('notifications-global', {
        config: { presence: { key: `user-${session.user.id}` } }
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
        }
      })
      .subscribe((status, err) => {
        if (err) {
          console.error('❌ Notification channel subscription error:', err);
          reconnectAttempts.current = 0;
        } else {
          console.log('✅ Notification channel status:', status);
          if (status === 'SUBSCRIBED') {
            reconnectAttempts.current = 0;
          }
        }
      });

    realtimeSubscriptions.current.set('notifications', notificationChannel);

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

  useEffect(() => {
    const handleVisibilityChange = () => {
      lastActivity.current = Date.now();
      
      if (document.visibilityState === 'visible' && session) {
        console.log('📱 App became visible - checking realtime connections...');
        
        setTimeout(() => {
          if (session && dataFetched.current) {
            const hasActiveSubscriptions = Array.from(realtimeSubscriptions.current.values()).some(
              channel => channel.state === 'joined' || channel.state === 'joining'
            );
            
            if (!hasActiveSubscriptions) {
              console.log('📱 No active realtime subscriptions found - reconnecting...');
              setupRealtimeSubscriptions();
            }
            
            const timeSinceLastActivity = Date.now() - lastActivity.current;
            if (timeSinceLastActivity > 30000) {
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

  useEffect(() => {
    if (!session || !dataFetched.current) return;

    const healthCheckInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        const activeChannels = Array.from(realtimeSubscriptions.current.values()).filter(
          channel => channel.state === 'joined'
        );
        
        console.log(`🔍 Health check: ${activeChannels.length}/${realtimeSubscriptions.current.size} channels active`);
        
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
          reconnectAttempts.current = 0;
        }
      }
    }, 15000);

    return () => clearInterval(healthCheckInterval);
  }, [session, forceRefreshNotifications, setupRealtimeSubscriptions]);

  useEffect(() => {
    const originalConsoleError = console.error;
    console.error = (...args) => {
      const firstArg = args[0];
      if (firstArg && (
        (typeof firstArg === 'string' && firstArg.includes('Operation execution failed without retry') && firstArg.includes('set-property')) ||
        (firstArg?.status === 409 && firstArg?.url?.includes('/users/by/onesignal_id')) ||
        (args.length >= 3 && typeof args[2] === 'number' && args[2] === 409 && typeof args[1] === 'string' && args[1].includes('api.onesignal.com'))
      )) {
        return;
      }
      originalConsoleError.apply(console, args);
    };
    return () => { console.error = originalConsoleError; };
  }, []);

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

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (mounted) {
        console.log('🔐 Auth state changed:', !!session);
        setSession(session);
        setAuthLoading(false);
        
        if (!session) {
          try {
            console.log('🔔 Logging out existing OneSignal user to clear identity...');
            await oneSignalService.logout();
          } catch (error) {
            console.warn('⚠️ OneSignal logout on session end failed (non-fatal):', error);
          }
          
          setUnauthedPage('landing');
          dataFetched.current = false;
          oneSignalInitialized.current = false;
          initializationInProgress.current = false;
          oneSignalOperationInProgress.current = false;
          tagsSetSuccessfully.current = false;
          setNotifications([]);
          setTopics([]);
          setToasts([]);
          setProfile(null);
          setIsPushEnabled(false);
          setIsPushLoading(false);
          
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

          navigate('/', { replace: true });
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
      pendingUpdates.current.forEach(timeout => clearTimeout(timeout));
      pendingUpdates.current.clear();
    };
  }, [navigate, oneSignalService]);

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

  useEffect(() => {
    if (!session || authLoading) {
      return;
    }

    if (oneSignalInitialized.current) {
      return;
    }

    const initOneSignal = async () => {
      if (initializationInProgress.current) return;

      try {
        initializationInProgress.current = true;
        setIsPushLoading(true);
        console.log('🔔 Initializing OneSignal...');

        // Enable verbose logging for debugging
        window.OneSignal.setLogLevel(4);

        // Initialize SDK and clean stale data
        await oneSignalService.initialize();
        console.log('🔔 SDK Initialized. Clearing any existing user identity...');
        
        await oneSignalService.cleanStalePlayerIds(session.user.id);
        await oneSignalService.logout();
        console.log('🔔 Identity cleared. Logging in new user...');

        // Login with retries for 409 conflicts
        let loginAttempts = 0;
        const maxLoginAttempts = 3;
        while (loginAttempts < maxLoginAttempts) {
          try {
            await oneSignalService.login(session.user.id);
            console.log(`✅ OneSignal login successful for user: ${session.user.id}`);
            break;
          } catch (error: any) {
            if (error?.status === 409 || (typeof error?.message === 'string' && error.message.includes('409'))) {
              loginAttempts++;
              console.warn(`⚠️ OneSignal login conflict (409). Retrying attempt ${loginAttempts}/${maxLoginAttempts}...`);
              await new Promise(resolve => setTimeout(resolve, 1500 * loginAttempts));
            } else {
              throw error;
            }
          }
        }

        // Check subscription status and set up listeners
        const isSubscribed = await oneSignalService.isSubscribed();
        console.log('🔔 OneSignal subscription status on load:', isSubscribed);
        setIsPushEnabled(isSubscribed);
        
        oneSignalService.onSubscriptionChange((subscribed: boolean) => {
          console.log('🔔 OneSignal subscription changed:', subscribed);
          setIsPushEnabled(subscribed);
        });

        oneSignalService.setupForegroundNotifications(handleNewNotification);
        
        oneSignalInitialized.current = true;
        console.log('✅ OneSignal initialization and login sequence completed');

      } catch (error) {
        console.error('❌ Failed to complete OneSignal setup:', error);
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
    
    const existingTimeout = pendingUpdates.current.get(notificationId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      pendingUpdates.current.delete(notificationId);
    }
    
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
    
    const updateTimeout = setTimeout(async () => {
      try {
        console.log('🔧 Executing database update for notification:', notificationId);
        
        const { data: existingNotification, error: checkError } = await supabase
          .from('notifications')
          .select('id')
          .eq('id', notificationId)
          .single();
        
        if (checkError) {
          if (checkError.code === 'PGRST116') {
            console.error('❌ Notification not found in database:', notificationId);
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
    }, 500);
    
    pendingUpdates.current.set(notificationId, updateTimeout);
  }, [notifications]);

  useEffect(() => {
    if (!session || dataFetched.current || authLoading) {
      return;
    }
    
    let mounted = true;
    
    const fetchInitialData = async () => {
      if (dataFetched.current) {
        console.log('⏭️ Data already fetched, skipping');
        return;
      }

      try {
        console.log('📊 Fetching initial data for user:', session.user.id);
        
        if (mounted) {
          setProfileLoading(true);
          setProfileError(null);
        }

        const { data: profileData, error: profileFetchError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (mounted) {
          if (profileFetchError) {
            console.error('❌ Error fetching profile:', profileFetchError);
            setProfileError('Failed to load your profile. There might be a network issue.');
            setProfile(null);
          } else if (profileData) {
            setProfile(profileData as Profile);
          } else {
            setProfileError('Your user profile could not be found.');
            setProfile(null);
          }
          setProfileLoading(false);
        }

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

        const { data: teamsData, error: teamsError } = await supabase
          .from('teams')
          .select('*');

        if (teamsError) {
          console.error('❌ Error fetching teams:', teamsError);
        } else if (teamsData && mounted) {
          console.log('✅ Teams fetched:', teamsData.length);
          setTeams(teamsData);
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

    fetchInitialData()
      .then(() => {
        if (mounted && dataFetched.current) {
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
      
      pendingUpdates.current.forEach(timeout => clearTimeout(timeout));
      pendingUpdates.current.clear();
      
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
  }, [session, authLoading]);

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
    
    if (oneSignalOperationInProgress.current) {
      console.log('⏸️ OneSignal operation already in progress');
      return;
    }

    setIsPushLoading(true);
    oneSignalOperationInProgress.current = true;

    const operationPromise = (async () => {
      console.log('🔔 Starting push subscription process...');
      
      let attempts = 0;
      const maxAttempts = 3;
      let playerId: string | null = null;
      while (attempts < maxAttempts) {
        try {
          playerId = await oneSignalService.subscribe();
          if (playerId) break;
          attempts++;
          console.warn(`⚠️ Subscription attempt ${attempts}/${maxAttempts} failed. Retrying...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
          attempts++;
          console.error(`❌ Subscription attempt ${attempts}/${maxAttempts} failed:`, error);
          if (attempts === maxAttempts) throw error;
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      if (!playerId) {
        throw new Error('Failed to get player ID from OneSignal after multiple attempts.');
      }
      
      console.log('🔔 OneSignal subscription successful, player ID:', playerId);
      await oneSignalService.savePlayerIdToDatabase(session.user.id);
      console.log('🔔 Player ID saved to database');
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const subscribedTopics = topics.filter(t => t.subscribed);
      if (subscribedTopics.length > 0 && !tagsSetSuccessfully.current) {
        try {
          const tags: Record<string, string> = {};
          subscribedTopics.forEach(topic => {
            tags[`topic_${topic.id}`] = '1';
          });
          
          let tagAttempts = 0;
          while (tagAttempts < 3) {
            try {
              await oneSignalService.setUserTags(tags);
              tagsSetSuccessfully.current = true;
              console.log('🔔 User tags set successfully for subscribed topics.');
              break;
            } catch (e: any) {
              if (e?.status === 409) {
                tagAttempts++;
                console.warn(`⚠️ Tags race condition (attempt ${tagAttempts}/3) - waiting 1s...`);
                await new Promise(resolve => setTimeout(resolve, 1000));
              } else {
                throw e;
              }
            }
          }
        } catch (tagError) {
          console.error('🔔 Failed to set user tags (non-critical):', tagError);
        }
      }
      
      const finalSubscribed = await oneSignalService.isSubscribed();
      setIsPushEnabled(finalSubscribed);
      
      if (finalSubscribed) {
        addToast({
          id: `sys-toast-${Date.now()}`,
          title: 'Push Notifications Enabled',
          message: 'You will now receive alerts in the background.',
          severity: 'low',
          status: 'new'
        } as ExtendedNotification);
      } else {
        throw new Error('Subscription confirmed as failed after setup.');
      }
    })();

    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Operation timed out')), 15000)
    );

    try {
      await Promise.race([operationPromise, timeoutPromise]);
    } catch (error) {
      console.error('🔔 Failed to subscribe to push notifications:', error);
      
      let errorMessage = 'Failed to enable push notifications. ';
      if (error instanceof Error) {
        if (error.message.includes('permission')) {
          errorMessage += 'Please check your browser settings and allow notifications for this site.';
        } else if (error.message.includes('player ID') || error.message.includes('multiple attempts')) {
          errorMessage += 'Could not register this device with the push service. Please try again.';
        } else if (error.message.includes('not supported')) {
          errorMessage += 'Your browser does not support push notifications.';
        } else if (error.message.includes('timed out')) {
          errorMessage += 'The operation timed out. Please try again.';
        } else {
          errorMessage += 'An unexpected error occurred. Please try again later.';
        }
      }
      
      addToast({
        id: `err-toast-${Date.now()}`,
        title: 'Subscription Error',
        message: errorMessage,
        severity: 'high',
        status: 'new'
      } as ExtendedNotification);
      
      setIsPushEnabled(false);
    } finally {
      setIsPushLoading(false);
      oneSignalOperationInProgress.current = false;
    }
  }, [session, topics, addToast, oneSignalService]);

  const unsubscribeFromPush = useCallback(async () => {
    if (!session) return;
    
    if (oneSignalOperationInProgress.current) {
      console.log('⏸️ OneSignal operation already in progress');
      return;
    }

    setIsPushLoading(true);
    oneSignalOperationInProgress.current = true;
    
    const operationPromise = (async () => {
      await oneSignalService.unsubscribe();
      await oneSignalService.removePlayerIdFromDatabase(session.user.id);
      
      tagsSetSuccessfully.current = false;
      
      const finalSubscribed = await oneSignalService.isSubscribed();
      setIsPushEnabled(finalSubscribed);
      
      addToast({
        id: `sys-toast-${Date.now()}`,
        title: 'Push Notifications Disabled',
        message: 'You will no longer receive background alerts.',
        severity: 'low',
        status: 'new'
      } as ExtendedNotification);
    })();

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Operation timed out')), 10000)
    );

    try {
      await Promise.race([operationPromise, timeoutPromise]);
    } catch (error) {
      console.error('🔔 Failed to unsubscribe from push notifications:', error);
      
      let errorMessage = 'Could not disable push notifications. Please try again.';
      if (error instanceof Error && error.message.includes('timed out')) {
        errorMessage = 'The operation timed out. Please try again.';
      }

      addToast({
        id: `err-toast-${Date.now()}`,
        title: 'Unsubscription Error',
        message: errorMessage,
        severity: 'high',
        status: 'new'
      } as ExtendedNotification);

      const revertedSubscribed = await oneSignalService.isSubscribed();
      setIsPushEnabled(revertedSubscribed);

    } finally {
      setIsPushLoading(false);
      oneSignalOperationInProgress.current = false;
    }
  }, [session, addToast, oneSignalService]);

  useEffect(() => {
    if (isPushEnabled && topics.length > 0 && session && !tagsSetSuccessfully.current && !oneSignalOperationInProgress.current) {
      const subscribedTopics = topics.filter(t => t.subscribed);
      if (subscribedTopics.length > 0) {
        const tags: Record<string, string> = {};
        subscribedTopics.forEach(topic => {
          tags[`topic_${topic.id}`] = '1';
        });
        
        setTimeout(async () => {
          if (oneSignalOperationInProgress.current) {
            console.log('⏸️ OneSignal operation in progress, skipping tag update');
            return;
          }
          
          oneSignalOperationInProgress.current = true;
          let attempts = 0;
          
          while (attempts < 3 && !tagsSetSuccessfully.current) {
            try {
              await oneSignalService.setUserTags(tags);
              tagsSetSuccessfully.current = true;
              console.log('🔔 User tags set successfully on app load.');
              break;
            } catch (e: any) {
              if (e?.status === 409) {
                attempts++;
                console.warn(`⚠️ Tags race (attempt ${attempts}/3) - waiting 1s...`);
                await new Promise(resolve => setTimeout(resolve, 1000));
              } else {
                console.error('❌ Failed to set tags:', e);
                break;
              }
            }
          }
          
          oneSignalOperationInProgress.current = false;
        }, 3000);
      }
    }
  }, [isPushEnabled, topics.length, session?.user.id, oneSignalService]);

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

  const handleLogout = useCallback(async () => {
    console.log('➡️ Starting logout process...');
    
    try {
      await oneSignalService.logout();
      console.log('🔔 Logged out from OneSignal');
    } catch (error) {
      console.error('❌ Error logging out from OneSignal (non-fatal):', error);
    }
    
    const { error } = await supabase.auth.signOut();
  
    if (error) {
      console.error('❌ Error signing out:', error);
      alert('Failed to sign out. Please try again.');
    }
  }, [oneSignalService]);

  const handleNavigate = useCallback((page: string) => {
    if (session) {
      navigate(`/${page}`);
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
      const { error, data } = await supabase
        .from('comments')
        .insert([{
          notification_id: notificationId,
          text: text.trim(),
          user_id: session.user.id
        }])
        .select('id')
        .single();

      if (error) {
        console.error("❌ Error adding comment:", error);
        alert(`Failed to add comment: ${error.message}`);
        throw error;
      }

      console.log('✅ Comment inserted successfully:', data.id);
    } catch (error) {
      console.error("❌ Failed to add comment:", error);
      throw error;
    }
  }, [session]);

  const handleAddTopic = useCallback(async (name: string, description: string, team_id: string | null) => {
    try {
      const { error } = await supabase.from('topics').insert([{ name, description, team_id }]);
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
        const { error } = await supabase.from('topic_subscriptions').delete().eq('id', topic.subscription_id);
        
        if (error) {
          console.error("Error unsubscribing:", error);
          alert(`Failed to unsubscribe: ${error.message}`);
          return;
        }
        
        console.log(`✅ Unsubscribed from ${topic.name}`);
        
        setTopics(prev => prev.map(t => 
          t.id === topic.id ? { ...t, subscribed: false, subscription_id: undefined } : t
        ));

        if (isPushEnabled && !oneSignalOperationInProgress.current) {
          oneSignalService.removeUserTags([`topic_${topic.id}`]).catch(e => console.warn('Failed to remove OneSignal tag', e));
        }

      } else {
        const { data, error } = await supabase
          .from('topic_subscriptions')
          .insert([{ user_id: session.user.id, topic_id: topic.id }])
          .select()
          .single();
          
        if (error) {
          console.error("Error subscribing:", error);
          alert(`Failed to subscribe: ${error.message}`);
          return;
        }

        console.log(`✅ Subscribed to ${topic.name}`);
        
        setTopics(prev => prev.map(t => 
          t.id === topic.id ? { ...t, subscribed: true, subscription_id: data.id } : t
        ));
        
        if (isPushEnabled && !oneSignalOperationInProgress.current) {
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
      await supabase.from('topic_subscriptions').delete().eq('topic_id', topic.id);

      const { error } = await supabase.from('topics').delete().eq('id', topic.id);
      if (error) {
        console.error("Error deleting topic:", error);
        alert(`Failed to delete topic: ${error.message}`);
      } else {
        console.log('✅ Topic deleted successfully');
        setTopics(prev => prev.filter(t => t.id !== topic.id));
      }
    } catch (error) {
      console.error('Error deleting topic:', error);
      alert('Failed to delete topic. Please try again.');
    }
  }, [session]);

  const handleUpdateTopicTeam = useCallback(async (topicId: string, teamId: string | null) => {
    try {
      const { error } = await supabase
        .from('topics')
        .update({ team_id: teamId })
        .eq('id', topicId);
  
      if (error) {
        console.error('Error updating topic team:', error);
        alert(`Failed to update topic team: ${error.message}`);
      } else {
        console.log(`✅ Topic ${topicId} assigned to team ${teamId}`);
        const { data, error: refreshError } = await supabase.from('topics').select('*').order('name');
        if (refreshError) {
          console.error('Error refetching topics:', refreshError);
        } else {
          const subscribedTopicIds = new Set(topics.filter(t => t.subscribed).map(t => t.id));
          const mergedTopics = data.map(topic => ({
            ...topic,
            subscribed: subscribedTopicIds.has(topic.id),
          }));
          setTopics(mergedTopics);
        }
      }
    } catch (error) {
      console.error('Error updating topic team:', error);
      alert('Failed to update topic team. Please try again.');
    }
  }, [topics]);
  
  const handleClearLogs = useCallback(async () => {
    if (!session) return;
    try {
      console.log('🔥 Clearing all notifications...');
      
      const { error } = await supabase
        .from('notifications')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (error) {
        console.error("❌ Error clearing notifications:", error);
        alert(`Failed to clear logs: ${error.message}`);
        return;
      }

      console.log('✅ All notifications cleared successfully');
      setNotifications([]);
      setToasts([]);

    } catch (error) {
      console.error("❌ Failed to clear logs:", error);
      alert('Failed to clear logs. Please try again.');
    }
  }, [session]);

  const themeContextValue = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme]);

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
              profile={profile}
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
                <Route path="/user-management" element={
                  <UserManagementPage
                    onLogout={handleLogout}
                    isSidebarOpen={isSidebarOpen}
                    setIsSidebarOpen={setIsSidebarOpen}
                    notifications={notifications}
                    openSettings={() => setIsSettingsOpen(true)}
                    systemStatus={systemStatus}
                    session={session}
                    onNavigate={handleNavigate}
                    topics={topics}
                    onUpdateTopicTeam={handleUpdateTopicTeam}
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
                <Route path="/synthetic-monitoring" element={
                  <SyntheticTestRunner />
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
                    teams={teams}
                  />
                }/>
                <Route path="*" element={(() => {
                  if (profileLoading) {
                    return (
                      <div className="flex-1 flex items-center justify-center">
                        <div className="text-center">
                          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                          <p>Loading Your Dashboard...</p>
                        </div>
                      </div>
                    );
                  }

                  if (profileError) {
                    return (
                      <div className="flex-1 flex items-center justify-center p-4">
                        <div className="text-center p-6 bg-red-50 dark:bg-red-900/20 border border-red-400 dark:border-red-700 rounded-lg max-w-md">
                          <h3 className="text-lg font-semibold text-red-800 dark:text-red-200">Dashboard Unavailable</h3>
                          <p className="text-red-600 dark:text-red-300 mt-2">
                            There was an issue loading your dashboard.
                          </p>
                          <p className="text-sm text-gray-500 mt-2">{profileError}</p>
                          <button
                            onClick={() => window.location.reload()}
                            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                          >
                            Try Again
                          </button>
                        </div>
                      </div>
                    );
                  }

                  if (session && profile) {
                    return (
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
                    );
                  }

                  return <SupabaseLoginPage />;
                })()}/>
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