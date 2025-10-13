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
import UserManagementPage from './pages/UserManagementPage';
import SyntheticMonitoringPage from './pages/monitoring/SyntheticMonitoringPage';
import ErrorBoundary from './components/ui/ErrorBoundary';

type NotificationFromDB = Database['public']['Tables']['notifications']['Row'];
type CommentFromDB = Database['public']['Tables']['comments']['Row'];
type TopicFromDB = Database['public']['Tables']['topics']['Row'];
type SubscriptionFromDB = Database['public']['Tables']['topic_subscriptions']['Row'];
type Team = Database['public']['Tables']['teams']['Row'];

interface ExtendedNotification extends Notification {
  oneSignalId?: string;
}

interface Profile {
  id: string;
  username?: string;
  avatar_url?: string;
  full_name?: string;
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
  const [userNames, setUserNames] = useState<Map<string, string>>(new Map());
  const navigate = useNavigate();
  const location = useLocation();
  const oneSignalService = OneSignalService.getInstance();
  const oneSignalInitialized = useRef(false);
  const dataFetched = useRef(false);
  const realtimeSubscriptions = useRef<Map<string, any>>(new Map());
  const pendingUpdates = useRef<Map<string, number>>(new Map());
  const handleNewNotificationRef = useRef<(notification: ExtendedNotification) => void>();

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
    if (path.startsWith('/user-management')) return 'user-management';
    return 'dashboard';
  }, [location.pathname]);

  const addToast = useCallback((notification: ExtendedNotification) => {
    console.log('🍞 Adding toast notification:', notification.title);
    setToasts(prev => {
      const exists = prev.some(n => 
        n.id === notification.id || 
        (n.oneSignalId && notification.oneSignalId && n.oneSignalId === notification.oneSignalId)
      );
      if (exists) {
        console.log('🔄 Toast already exists, skipping');
        return prev;
      }
      return [{ ...notification }, ...prev];
    });
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
    handleNewNotificationRef.current = handleNewNotification;
  }, [handleNewNotification]);

  const setupRealtimeSubscriptions = useCallback(() => {
    if (!session || !dataFetched.current) {
      console.log('⏸️ Skipping realtime setup - not ready', { session: !!session, dataFetched: dataFetched.current });
      return;
    }

    console.log('🔗 Setting up realtime subscriptions for user:', session.user.id);

    // Clean up existing subscriptions
    realtimeSubscriptions.current.forEach(channel => {
      try {
        if (channel.state !== 'closed') {
          supabase.removeChannel(channel);
          console.log('🧹 Removed existing channel:', channel.name);
        }
      } catch (error) {
        console.warn('⚠️ Error cleaning up old channel:', error);
      }
    });
    realtimeSubscriptions.current.clear();

    const subscribeWithRetry = (channelName: string, channel: any, maxRetries: number = 3, retryDelay: number = 2000) => {
      let retryCount = 0;
      channel.subscribe((status: string, err: any) => {
        if (err) {
          console.error(`❌ ${channelName} channel subscription error:`, err);
          if (retryCount < maxRetries && status === 'TIMED_OUT') {
            retryCount++;
            console.log(`🔄 Retrying ${channelName} channel subscription (attempt ${retryCount}/${maxRetries})`);
            setTimeout(() => channel.subscribe(), retryDelay);
          }
        } else {
          console.log(`✅ ${channelName} channel status:`, status);
        }
      });
    };

    // Notifications channel
    const notificationChannel = supabase
      .channel('notifications-global')
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
        
        const newNotification = { ...payload.new, comments: [] } as ExtendedNotification;
        
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
          handleNewNotificationRef.current?.(newNotification);
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
          setNotifications(prev => {
            const updatedNotifications = prev.map(n => {
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
            });
            console.log('🔔 Updated notifications state:', updatedNotifications.length);
            return updatedNotifications;
          });
        } else {
          console.log('⏸️ Skipping realtime update - local update pending for:', payload.new.id);
        }
      })
      .on('system', { event: '*' }, (payload) => {
        console.log('📱 System event:', payload);
        if (payload.event === 'phx_error' || payload.status === 'error') {
          console.error('❌ Realtime connection error detected:', payload);
        }
      });

    subscribeWithRetry('Notifications', notificationChannel);
    realtimeSubscriptions.current.set('notifications', notificationChannel);

    // Comments channel
    const commentsChannel = supabase
      .channel(`comments-${session.user.id}`)
      .on<CommentFromDB>('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'comments'
      }, async (payload) => {
        console.log('💬 New comment received via realtime:', payload.new);
        const newCommentPayload = payload.new;
        const newComment = { ...newCommentPayload } as Comment;

        if (newComment.user_id && !userNames.has(newComment.user_id)) {
          console.log(`Fetching new user name for ${newComment.user_id}`);
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', newComment.user_id)
            .single();
          if (profileData) {
            setUserNames(prev => new Map(prev).set(newComment.user_id, profileData.full_name || 'Unknown User'));
          }
        }

        setNotifications(prev => {
          const notification = prev.find(n => n.id === newComment.notification_id);
          if (notification && notification.comments.some(c => c.id === newComment.id)) {
            console.log('🔄 Comment already exists, skipping');
            return prev;
          }
          
          const updatedNotifications = prev.map(n =>
            n.id === newComment.notification_id
              ? {
                  ...n,
                  comments: [...(n.comments || []), newComment]
                    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                }
              : n
          );
          console.log('🔔 Updated notifications with new comment:', updatedNotifications.length);
          return updatedNotifications;
        });
      })
      .on('system', { event: '*' }, (payload) => {
        if (payload.event === 'phx_error' || payload.status === 'error') {
          console.error('❌ Comments channel error detected:', payload);
        }
      });

    subscribeWithRetry('Comments', commentsChannel);
    realtimeSubscriptions.current.set('comments', commentsChannel);

    // Topics channel
    const topicChannel = supabase
      .channel(`topics-${session.user.id}`)
      .on<TopicFromDB>('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'topics' 
      }, payload => {
        console.log('📂 New topic received:', payload.new);
        setTopics(prev => [...prev, { ...payload.new, subscribed: false } as Topic]);
      })
      .on('system', { event: '*' }, (payload) => {
        if (payload.event === 'phx_error' || payload.status === 'error') {
          console.error('❌ Topics channel error detected:', payload);
        }
      });

    subscribeWithRetry('Topics', topicChannel);
    realtimeSubscriptions.current.set('topics', topicChannel);

    // Subscriptions channel
    const subscriptionChannel = supabase
      .channel(`subscriptions-${session.user.id}`)
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
            t.id === newSub.topic_id ? { ...t, subscribed: true, subscription_id: newSub.id } : t
          ));
        }
        if (payload.eventType === 'DELETE') {
          const oldSub = payload.old as Partial<SubscriptionFromDB>;
          if (oldSub?.topic_id) {
            setTopics(prev => prev.map(t => 
              t.id === oldSub.topic_id ? { ...t, subscribed: false, subscription_id: undefined } : t
            ));
          }
        }
      })
      .on('system', { event: '*' }, (payload) => {
        if (payload.event === 'phx_error' || payload.status === 'error') {
          console.error('❌ Subscriptions channel error detected:', payload);
        }
      });

    subscribeWithRetry('Subscriptions', subscriptionChannel);
    realtimeSubscriptions.current.set('subscriptions', subscriptionChannel);

    // Monitored sites channel
    const sitesChannel = supabase
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
      );

    subscribeWithRetry('Sites', sitesChannel);
    realtimeSubscriptions.current.set('monitored_sites', sitesChannel);
    
    console.log('✅ All realtime subscriptions set up successfully');
  }, [session]);

  // Dedicated effect for setting up real-time subscriptions
  useEffect(() => {
    if (!session || !dataFetched.current) return;

    console.log('🚀 Triggering real-time subscriptions setup');
    setupRealtimeSubscriptions();

    return () => {
      console.log('🧹 Cleaning up real-time subscriptions');
      realtimeSubscriptions.current.forEach(channel => {
        try {
          supabase.removeChannel(channel);
        } catch (error) {
          console.warn('⚠️ Error cleaning up channel:', error);
        }
      });
      realtimeSubscriptions.current.clear();
    };
  }, [session, setupRealtimeSubscriptions]);

  // Periodic connection health check
  useEffect(() => {
    if (!session || !dataFetched.current) return;

    const healthCheckInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        const activeChannels = Array.from(realtimeSubscriptions.current.values()).filter(
          channel => channel.state === 'joined'
        );
        
        console.log(`🔍 Health check: ${activeChannels.length}/${realtimeSubscriptions.current.size} channels active`);
      }
    }, 30000);

    return () => clearInterval(healthCheckInterval);
  }, [session]);

  // Auth Effect
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
          setUnauthedPage('landing');
          dataFetched.current = false;
          oneSignalInitialized.current = false;
          setNotifications([]);
          setTopics([]);
          setToasts([]);
          setSites([]);
          setProfile(null);
          setIsPushEnabled(false);
          setIsPushLoading(false);
          
          pendingUpdates.current.forEach(timeout => window.clearTimeout(timeout));
          pendingUpdates.current.clear();
          
          console.log('🧹 Clearing realtime subscriptions due to auth change');
          realtimeSubscriptions.current.forEach(channel => {
            try {
              supabase.removeChannel(channel);
            } catch (error) {
              console.warn('Error removing channel:', error);
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
  }, [navigate]);

  // OneSignal Initialization and Subscription Change Handler
  useEffect(() => {
    if (!session || oneSignalInitialized.current) {
      return;
    }
    
    // --- Add this line ---
    oneSignalInitialized.current = true;
    console.log('🚩 OneSignal initialization sequence initiated.');

    const initAndSetupListeners = async () => {
      try {
        console.log('🔔 Initializing OneSignal...');
        await oneSignalService.initialize();
        console.log(`🔔 Logging into OneSignal with external user ID: ${session.user.id}`);
        await oneSignalService.login(session.user.id);

        const isSubscribed = await oneSignalService.isSubscribed();
        console.log('🔔 Initial OneSignal subscription state:', isSubscribed);
        setIsPushEnabled(isSubscribed);
        
        oneSignalService.onSubscriptionChange((subscribed: boolean) => {
          console.log('🔔 Subscription state changed in background to:', subscribed);
          setIsPushEnabled(subscribed);
        });

        oneSignalService.setupForegroundNotifications((notification) => handleNewNotificationRef.current!(notification));
        
        console.log('✅ OneSignal initialization and listeners setup complete.');
      } catch (error) {
        console.error('❌ Failed to initialize OneSignal:', error);
        
        // --- And add this line ---
        oneSignalInitialized.current = false; // Reset on failure to allow re-attempts

        alert('Failed to set up push notifications. Please refresh the page and try again.');
      } finally {
        setIsPushLoading(false);
      }
    };

    initAndSetupListeners();
  }, [session, oneSignalService]); // Make sure oneSignalService is in the dependency array

  // Data Fetching
  useEffect(() => {
    if (!session || dataFetched.current || authLoading) {
      console.log('⏸️ Skipping data fetch', { session: !!session, dataFetched: dataFetched.current, authLoading });
      return;
    }

    let mounted = true;

    const fetchInitialData = async () => {
      try {
        console.log('📊 Fetching initial data for user:', session.user.id);
        
        setProfileLoading(true);
        setProfileError(null);

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
              comments: comments.map((c: CommentFromDB) => ({ ...c }))
            };
          });
          
          console.log('✅ Notifications fetched:', transformedData.length);
          setNotifications(transformedData as ExtendedNotification[]);
        } else {
          console.log('📭 No notifications found');
          setNotifications([]);
        }

        const [topicsResult, subscriptionsResult, teamsResult, sitesResult] = await Promise.all([
          supabase.from('topics').select('*').order('name'),
          supabase.from('topic_subscriptions').select('*').eq('user_id', session.user.id),
          supabase.from('teams').select('*'),
          supabase.from('monitored_sites').select('*')
        ]);

        if (topicsResult.error) {
          console.error('❌ Error fetching topics:', topicsResult.error);
          throw topicsResult.error;
        }

        if (subscriptionsResult.error) {
          console.error('❌ Error fetching subscriptions:', subscriptionsResult.error);
          throw subscriptionsResult.error;
        }

        if (teamsResult.error) {
          console.error('❌ Error fetching teams:', teamsResult.error);
          throw teamsResult.error;
        }

        if (sitesResult.error) {
          console.error('❌ Error fetching monitored sites:', sitesResult.error);
          throw sitesResult.error;
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

        if (teamsResult.data && mounted) {
          console.log('✅ Teams fetched:', teamsResult.data.length);
          setTeams(teamsResult.data);
        }

        if (sitesResult.data && mounted) {
          console.log('✅ Sites fetched:', sitesResult.data.length);
          setSites(sitesResult.data);
          setLoadingSites(false);
        }

        dataFetched.current = true;
        console.log('✅ Initial data fetch completed successfully');
      } catch (error) {
        console.error('❌ Error in fetchInitialData:', error);
        dataFetched.current = false;
        
        if (mounted) {
          setNotifications([]);
          setTopics([]);
          setSites([]);
          setLoadingSites(false);
        }
      }
    };

    fetchInitialData();
    return () => {
      console.log('🧹 Cleaning up data fetching effect...');
      mounted = false;
      
      pendingUpdates.current.forEach(timeout => window.clearTimeout(timeout));
      pendingUpdates.current.clear();
      
      realtimeSubscriptions.current.forEach(channel => {
        try {
          supabase.removeChannel(channel);
        } catch (error) {
          console.warn('⚠️ Error cleaning up channel:', error);
        }
      });
      realtimeSubscriptions.current.clear();
    };
  }, [session, authLoading]);

  // Fetch User Names
  useEffect(() => {
    if (!session) return;

    const fetchUserNames = async () => {
      const userIds = new Set<string>();
      notifications.forEach(n => {
        (n.comments || []).forEach(c => {
          if (c.user_id) {
            userIds.add(c.user_id);
          }
        });
      });

      if (userIds.size > 0) {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', Array.from(userIds));

        if (error) {
          console.error('Error fetching user names:', error);
        } else {
          const names = new Map<string, string>();
          data.forEach(profile => {
            names.set(profile.id, profile.full_name || 'Unknown User');
          });
          setUserNames(names);
        }
      }
    };

    if (notifications.length > 0) {
      fetchUserNames();
    }
  }, [notifications, session]);

  const forceRefreshNotifications = useCallback(async () => {
    if (!session) return;
    
    console.log('🔄 Force refreshing notifications...');
    
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
            comments: comments.map((c: CommentFromDB) => ({ ...c }))
          };
        });
        
        console.log('✅ Notifications force refreshed successfully:', transformedData.length);
        setNotifications(transformedData as ExtendedNotification[]);
      } else {
        console.log('📭 No notifications found during force refresh');
        setNotifications([]);
      }
    } catch (error) {
      console.error('Error in force refresh:', error);
      alert('Failed to refresh notifications. Please try again.');
    }
  }, [session]);

  const updateNotification = useCallback(async (notificationId: string, updates: NotificationUpdatePayload) => {
    console.log('🔧 Updating notification:', { notificationId, updates });
    
    const originalNotification = notifications.find(n => n.id === notificationId);
    if (!originalNotification) {
      console.error('❌ Original notification not found for update');
      return;
    }
    
    const existingTimeout = pendingUpdates.current.get(notificationId);
    if (existingTimeout) {
      window.clearTimeout(existingTimeout);
      pendingUpdates.current.delete(notificationId);
    }
    
    setNotifications(prev => {
      const updatedNotifications = prev.map(n => {
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
      });
      console.log('🔔 Updated notifications state for update:', updatedNotifications.length);
      return updatedNotifications;
    });
    
    const updateTimeout = window.setTimeout(async () => {
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
        alert('Failed to update notification. Please try again.');
      } finally {
        pendingUpdates.current.delete(notificationId);
      }
    }, 500);
    
    pendingUpdates.current.set(notificationId, updateTimeout);
  }, [notifications]);

  const subscribeToPush = useCallback(async () => {
    if (!session) {
      console.warn('🔔 No session available, cannot subscribe to push notifications');
      return;
    }
    setIsPushLoading(true);
    try {
      console.log('🔔 Starting subscription process...');
      const playerId = await oneSignalService.subscribe();
      if (!playerId) {
        throw new Error('Failed to obtain player ID after subscription');
      }

      await oneSignalService.savePlayerIdToDatabase(session.user.id);
      console.log('✅ Player ID saved to database:', playerId);

      const subscribedTopics = topics.filter(t => t.subscribed);
      if (subscribedTopics.length > 0) {
        console.log('🏷️ Applying tags for subscribed topics...');
        const tags: Record<string, string> = {};
        subscribedTopics.forEach(topic => {
          tags[`topic_${topic.id}`] = '1';
        });
        await oneSignalService.setUserTags(tags);
        console.log('✅ Tags applied successfully');
      }

      setIsPushEnabled(true);
      console.log('✅ Successfully subscribed to push notifications');
    } catch (error) {
      console.error('❌ Failed to subscribe to push notifications:', error);
      alert('Could not enable push notifications. Please check your browser settings and try again.');
    } finally {
      setIsPushLoading(false);
    }
  }, [session, oneSignalService, topics]);

  const unsubscribeFromPush = useCallback(async () => {
    if (!session) {
      console.warn('🔔 No session available, cannot unsubscribe from push notifications');
      return;
    }
    setIsPushLoading(true);
    try {
      console.log('🔔 Starting unsubscription process...');
      await oneSignalService.unsubscribe();
      await oneSignalService.removeCurrentPlayerIdFromDatabase();
      console.log('✅ Player ID removed from database');
      setIsPushEnabled(false);
      console.log('✅ Successfully unsubscribed from push notifications');
    } catch (error) {
      console.error('❌ Failed to unsubscribe from push notifications:', error);
      alert('Could not disable push notifications. Please try again.');
    } finally {
      setIsPushLoading(false);
    }
  }, [session, oneSignalService]);

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

  const handleLogout = useCallback(async () => {
    console.log('➡️ Starting logout process...');
    
    try {
      await oneSignalService.logout();
      console.log('🔔 Logged out from OneSignal');
      await oneSignalService.removeAllPlayerIdsFromDatabase(session!.user.id);
    } catch (error) {
      console.error('❌ Error logging out from OneSignal (non-fatal):', error);
    }
    
    const { error } = await supabase.auth.signOut();
  
    if (error) {
      console.error('❌ Error signing out:', error);
      alert('Failed to sign out. Please try again.');
    }
  }, [session, oneSignalService]);

  const handleNavigate = useCallback((page: string) => {
    if (session) {
      navigate(`/${page}`);
    }
    setIsSidebarOpen(false);
  }, [session, navigate]);
  
  const sendTestAlert = useCallback(async () => {
    if (!session) return;

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
      severity: 'high' as Severity,
      status: 'new' as NotificationStatus,
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
  }, [snoozedUntil, topics, session]);

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
        .select('id, notification_id, text, user_id, created_at')
        .single();

      if (error) {
        console.error("❌ Error adding comment:", error);
        alert(`Failed to add comment: ${error.message}`);
        throw error;
      }

      console.log('✅ Comment inserted successfully:', data.id);
    } catch (error) {
      console.error("❌ Failed to add comment:", error);
      alert('Failed to add comment. Please try again.');
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

        if (isPushEnabled) {
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
        
        if (isPushEnabled) {
          oneSignalService.setUserTags({ [`topic_${topic.id}`]: '1' }).catch(e => console.warn('Failed to set OneSignal tag', e));
        }
      }
    } catch (error: any) {
      console.error('Error toggling subscription:', error);
      alert('Failed to update subscription. Please try again.');
    }
  }, [session, isPushEnabled, oneSignalService]);

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
            subscription_id: topics.find(t => t.id === topic.id && t.subscribed)?.subscription_id
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
                    userNames={userNames}
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
                  <SyntheticMonitoringPage />
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
                    console.log('🖼️ Rendering DashboardPage with notifications:', notifications.length);
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