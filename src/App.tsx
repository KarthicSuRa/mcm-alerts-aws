/// <reference types="vite/client" />

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { LandingPage } from './pages/LandingPage';
import { SupabaseLoginPage } from './pages/SupabaseLoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ApiDocsPage } from './pages/ApiDocsPage';
import { AuditLogsPage } from './pages/AuditLogsPage';
import { HowItWorksPage } from './pages/HowItWorksPage';
import { Sidebar } from './components/layout/Sidebar';
import { SettingsModal } from './components/layout/SettingsModal';
import { NotificationToast } from './components/ui/NotificationToast';
import { Theme, type Notification, Severity, NotificationStatus, SystemStatusData, Session, Comment, NotificationUpdatePayload, Topic, Database } from './types';
import { supabase } from './lib/supabaseClient';
import { OneSignalService } from './lib/oneSignalService';
import { ThemeContext } from './contexts/ThemeContext';
import ErrorBoundary from './components/ui/ErrorBoundary';

type NotificationFromDB = Database['public']['Tables']['notifications']['Row'];
type CommentFromDB = Database['public']['Tables']['comments']['Row'];
type TopicFromDB = Database['public']['Tables']['topics']['Row'];
type SubscriptionFromDB = Database['public']['Tables']['topic_subscriptions']['Row'];

function App() {
  const [theme, setTheme] = useState<Theme>('light');
  const [session, setSession] = useState<Session | null>(null);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [unauthedPage, setUnauthedPage] = useState<'landing' | 'login'>('landing');

  // Settings State
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [snoozedUntil, setSnoozedUntil] = useState<Date | null>(null);
  const [isPushEnabled, setIsPushEnabled] = useState(false);
  const [isPushLoading, setIsPushLoading] = useState(true);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [toasts, setToasts] = useState<Notification[]>([]);

  // OneSignal service instance
  const oneSignalService = OneSignalService.getInstance();
  
  // Add refs to prevent multiple initializations
  const oneSignalInitialized = useRef(false);
  const dataFetched = useRef(false);
  const realtimeSubscriptions = useRef<Map<string, any>>(new Map());

  const addToast = useCallback((notification: Notification) => {
    console.log('🍞 Adding toast notification:', notification.title);
    setToasts(prev => [{...notification}, ...prev]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const systemStatus: SystemStatusData = useMemo(() => ({
    service: 'Ready',
    database: 'Connected',
    push: 'OneSignal',
    subscription: isPushEnabled ? 'Active' : 'Inactive',
  }), [isPushEnabled]);

  // --- Auth Effect (FIXED: Added proper cleanup) ---
  useEffect(() => {
    let mounted = true;
    
    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (mounted) {
        setSession(session);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setSession(session);
        // Reset data fetch flag when auth state changes
        dataFetched.current = false;
        
        // Clear existing subscriptions when auth changes
        if (!session) {
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
    };
  }, []);

  // --- OneSignal Initialization (FIXED: Prevent multiple inits) ---
  useEffect(() => {
    if (oneSignalInitialized.current) return;
    
    const initOneSignal = async () => {
      try {
        oneSignalInitialized.current = true;
        await oneSignalService.initialize();
        
        // Check if user is already subscribed
        const isSubscribed = await oneSignalService.isSubscribed();
        setIsPushEnabled(isSubscribed);
        
        // Set up subscription change listener (only once)
        oneSignalService.onSubscriptionChange((subscribed: boolean) => {
          console.log('🔔 OneSignal subscription changed:', subscribed);
          setIsPushEnabled(subscribed);
        });

        // Set up notification click listener (only once)
        oneSignalService.onNotificationClick((event: any) => {
          console.log('🔔 OneSignal notification clicked:', event);
        });

        // If user is logged in and subscribed, save player ID to database
        if (session && isSubscribed) {
          await oneSignalService.savePlayerIdToDatabase(session.user.id);
        }
      } catch (error) {
        console.error('Failed to initialize OneSignal:', error);
        oneSignalInitialized.current = false; // Allow retry on error
      } finally {
        setIsPushLoading(false);
      }
    };

    initOneSignal();
  }, [session]); // Added session dependency to handle player ID saving

  // --- Handle New Notifications (FIXED: Better sound and toast handling) ---
  const handleNewNotification = useCallback(async (notification: Notification) => {
    console.log('🔔 Handling new notification:', {
      id: notification.id,
      title: notification.title,
      severity: notification.severity,
      topic_id: notification.topic_id,
      snoozedUntil,
      soundEnabled
    });

    // Check if notifications are snoozed
    if (snoozedUntil && new Date() < snoozedUntil) {
      console.log("⏰ Alerts are snoozed. Notification sound/toast blocked.");
      return;
    }

    // Check if user is subscribed to this topic
    const notificationTopic = topics.find(t => t.id === notification.topic_id);
    if (notification.topic_id && (!notificationTopic || !notificationTopic.subscribed)) {
      console.log("📵 User not subscribed to this topic. Notification sound/toast blocked.", {
        topicId: notification.topic_id,
        topicFound: !!notificationTopic,
        subscribed: notificationTopic?.subscribed
      });
      return;
    }

    // Show toast notification with a unique ID for tracking
    const toastNotification = {
      ...notification,
      id: `toast-${notification.id}-${Date.now()}` // Ensure unique toast ID
    };
    addToast(toastNotification);

    // Play sound if enabled
    if (soundEnabled) {
      try {
        console.log('🔊 Playing notification sound');
        const audio = new Audio('/alert.wav');
        audio.volume = 0.7; // Slightly reduce volume
        await audio.play();
        console.log('✅ Notification sound played successfully');
      } catch (error) {
        console.error("❌ Error playing sound:", error);
      }
    }
  }, [soundEnabled, snoozedUntil, topics, addToast]);

  // FIXED: updateNotification function with better optimistic updates
  const updateNotification = useCallback(async (notificationId: string, updates: NotificationUpdatePayload) => {
    console.log('🔧 Updating notification:', { notificationId, updates });
    
    // Store original notification for potential revert
    const originalNotification = notifications.find(n => n.id === notificationId);
    if (!originalNotification) {
      console.error('❌ Original notification not found for update');
      return;
    }
    
    // OPTIMISTIC UPDATE: Update UI immediately for better UX
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
        } as Notification;
      }
      return n;
    }));
    
    try {
      // Make the database update
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
        
        // REVERT OPTIMISTIC UPDATE on error
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
    }
  }, [notifications]);

  // --- FIXED: Enhanced Data Fetching and Realtime Subscriptions ---
  useEffect(() => {
    if (!session || dataFetched.current) return;
    
    let mounted = true;
    
    const fetchInitialData = async () => {
      try {
        console.log('📊 Fetching initial data...');
        dataFetched.current = true;
        
        // Fetch notifications with better error handling
        const { data: notificationsData, error: notificationsError } = await supabase
          .from('notifications')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100); // Limit to prevent excessive data

        if (notificationsError) {
          console.error('❌ Error fetching notifications:', notificationsError);
          dataFetched.current = false; // Allow retry
          return;
        }

        if (notificationsData && mounted) {
          const notificationIds = notificationsData.map(n => n.id);
          const commentsByNotificationId = new Map<string, CommentFromDB[]>();

          // Fetch comments if there are notifications
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
          setNotifications(transformedData as Notification[]);
        }

        // Fetch topics and user subscriptions
        const [topicsResult, subscriptionsResult] = await Promise.all([
          supabase.from('topics').select('*').order('name'),
          supabase.from('topic_subscriptions').select('*').eq('user_id', session.user.id)
        ]);

        if (topicsResult.error || subscriptionsResult.error) {
          console.error('❌ Error fetching topics/subscriptions:', topicsResult.error || subscriptionsResult.error);
          return;
        }

        if (topicsResult.data && subscriptionsResult.data && mounted) {
          const subscribedTopicIds = new Set(subscriptionsResult.data.map(sub => sub.topic_id));
          const mergedTopics = topicsResult.data.map(topic => ({
            ...topic,
            subscribed: subscribedTopicIds.has(topic.id),
            subscription_id: subscriptionsResult.data.find(s => s.topic_id === topic.id)?.id,
          }));
          console.log('✅ Topics fetched:', mergedTopics.length);
          setTopics(mergedTopics);
        }

      } catch (error) {
        console.error('❌ Error in fetchInitialData:', error);
        dataFetched.current = false; // Allow retry
      }
    };

    const setupRealtimeSubscriptions = () => {
      if (!mounted) return;

      console.log('🔗 Setting up realtime subscriptions...');

      // Clean up existing subscriptions first
      realtimeSubscriptions.current.forEach(channel => {
        try {
          channel.unsubscribe();
        } catch (error) {
          console.warn('⚠️ Error cleaning up old channel:', error);
        }
      });
      realtimeSubscriptions.current.clear();

      // FIXED: Notification channel with better INSERT and UPDATE handling
      const notificationChannel = supabase
        .channel(`notifications-${session.user.id}`, {
          config: {
            broadcast: { self: false },
            presence: { key: session.user.id }
          }
        })
        .on<NotificationFromDB>('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'notifications' 
        }, async (payload) => {
          if (!mounted) return;
          
          console.log('🔵 New notification received via realtime:', payload.new);
          const newNotification = {...payload.new, comments: [] } as Notification;
          
          // Add to notifications list
          setNotifications(prev => {
            // Check if notification already exists (prevent duplicates)
            const exists = prev.some(n => n.id === newNotification.id);
            if (exists) {
              console.log('🔄 Notification already exists, skipping INSERT');
              return prev;
            }
            console.log('➕ Adding new notification to list');
            return [newNotification, ...prev];
          });
          
          // Trigger notification handlers (sound/toast) with delay to ensure state is updated
          setTimeout(() => {
            handleNewNotification(newNotification);
          }, 100);
        })
        .on<NotificationFromDB>('postgres_changes', { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'notifications' 
        }, payload => {
          if (!mounted) return;
          console.log('🟡 Notification UPDATE received via realtime:', {
            id: payload.new.id,
            oldStatus: payload.old?.status,
            newStatus: payload.new.status,
            timestamp: new Date().toISOString()
          });
          
          setNotifications(prev => {
            const updated = prev.map(n => {
              if (n.id === payload.new.id) {
                console.log('🟢 Applying realtime update:', {
                  id: n.id,
                  oldStatus: n.status,
                  newStatus: payload.new.status
                });
                
                return {
                  ...n,
                  ...payload.new,
                  comments: n.comments || [], // Preserve comments
                  updated_at: payload.new.updated_at || new Date().toISOString()
                } as Notification;
              }
              return n;
            });
            
            // Verify the update was applied
            const updatedNotification = updated.find(n => n.id === payload.new.id);
            if (updatedNotification) {
              console.log('✅ Realtime update applied successfully:', {
                id: updatedNotification.id,
                status: updatedNotification.status
              });
            }
            
            return updated;
          });
        })
        .subscribe((status, err) => {
          if (err) {
            console.error('❌ Notification channel subscription error:', err);
          } else {
            console.log('✅ Notification channel status:', status);
          }
        });

      realtimeSubscriptions.current.set('notifications', notificationChannel);

      // Comments channel
      const commentsChannel = supabase
        .channel(`comments-${session.user.id}`, {
          config: {
            broadcast: { self: false },
            presence: { key: session.user.id }
          }
        })
        .on<CommentFromDB>('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'comments' 
        }, async (payload) => {
          if (!mounted) return;
          console.log('💬 New comment received:', payload.new);
          const newCommentPayload = payload.new;
          const newComment = {
            ...newCommentPayload,
            user_email: newCommentPayload.user_id === session.user.id ? 
              (session.user.email ?? 'Current User') : 'Another User'
          } as Comment;
          
          setNotifications(prev => prev.map(n => 
            n.id === newComment.notification_id 
              ? { 
                  ...n, 
                  comments: [...(n.comments || []), newComment]
                    .sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) 
                } 
              : n
          ));
        })
        .subscribe((status, err) => {
          if (err) {
            console.error('❌ Comments channel subscription error:', err);
          } else {
            console.log('✅ Comments channel status:', status);
          }
        });

      realtimeSubscriptions.current.set('comments', commentsChannel);

      // Topics channel
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
          if (!mounted) return;
          console.log('📂 New topic received:', payload.new);
          setTopics(prev => [...prev, {...payload.new, subscribed: false} as Topic]);
        })
        .subscribe((status, err) => {
          if (err) {
            console.error('❌ Topics channel subscription error:', err);
          } else {
            console.log('✅ Topics channel status:', status);
          }
        });

      realtimeSubscriptions.current.set('topics', topicChannel);

      // Subscriptions channel
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
          if (!mounted) return;
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
        .subscribe((status, err) => {
          if (err) {
            console.error('❌ Subscriptions channel subscription error:', err);
          } else {
            console.log('✅ Subscriptions channel status:', status);
          }
        });

      realtimeSubscriptions.current.set('subscriptions', subscriptionChannel);
      
      console.log('✅ All realtime subscriptions set up successfully');
    };

    // Execute both functions with proper sequencing
    fetchInitialData().then(() => {
      if (mounted) {
        // Small delay to ensure data is properly set before setting up subscriptions
        setTimeout(() => {
          if (mounted) {
            setupRealtimeSubscriptions();
          }
        }, 500);
      }
    });

    return () => {
      console.log('🧹 Cleaning up realtime subscriptions...');
      mounted = false;
      
      // Clean up channels with proper error handling
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
  }, [session, handleNewNotification]);

  // --- Enhanced OneSignal Push Subscription Management ---
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
      
      console.log('🔔 Waiting for player registration to complete...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
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

  // DEBUGGING: Add a useEffect to monitor notification status changes
  useEffect(() => {
    const statusCounts = notifications.reduce((acc, n) => {
      acc[n.status] = (acc[n.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    if (notifications.length > 0) {
      console.log('📊 Notification status summary:', {
        total: notifications.length,
        counts: statusCounts,
        recentlyUpdated: notifications
          .filter(n => n.updated_at && new Date(n.updated_at).getTime() > Date.now() - 5000)
          .map(n => ({ id: n.id.slice(-8), status: n.status, updated_at: n.updated_at }))
      });
    }
  }, [notifications]);

  // Force refresh mechanism as backup
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
        
        setNotifications(transformedData as Notification[]);
        console.log('✅ Notifications force refreshed successfully');
      }
    } catch (error) {
      console.error('Error in force refresh:', error);
    }
  }, [session]);
  
  const handleUnauthedNavigate = useCallback((page: 'landing' | 'login') => {
    setUnauthedPage(page);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
  }, []);

  const handleLogout = useCallback(async () => {
    if (isPushEnabled && session) {
      try {
        await oneSignalService.removePlayerIdFromDatabase(session.user.id);
      } catch (error) {
        console.error('Error removing player ID on logout:', error);
      }
    }
    
    dataFetched.current = false;
    oneSignalInitialized.current = false;
    
    await supabase.auth.signOut();
    setUnauthedPage('landing');
  }, [isPushEnabled, session]);

  const handleNavigate = useCallback((page: string) => {
    if (session) {
      setCurrentPage(page);
    }
    setIsSidebarOpen(false);
  }, [session]);
  
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
      alert("Please subscribe to at least one topic to send a test alert.");
      return;
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
        // Don't manually add toast here - let the realtime subscription handle it
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
    
    console.log('💬 Adding comment:', { notificationId, text });
    
    try {
      const { error, data } = await supabase
        .from('comments')
        .insert([{ 
          notification_id: notificationId, 
          text: text.trim(), 
          user_id: session.user.id 
        }])
        .select()
        .single();
      
      if (error) {
        console.error("❌ Error adding comment:", error);
        throw error;
      }
      
      console.log('✅ Comment added successfully:', data);
      
      // Optimistic update for immediate feedback
      const newComment = {
        ...data,
        user_email: session.user.email ?? 'Current User'
      } as Comment;
      
      setNotifications(prev => prev.map(n => 
        n.id === notificationId 
          ? { 
              ...n, 
              comments: [...(n.comments || []), newComment]
                .sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) 
            } 
          : n
      ));
      
    } catch (error) {
      console.error("❌ Failed to add comment:", error);
      throw error;
    }
  }, [session]);

  const handleAddTopic = useCallback(async (name: string, description: string) => {
    const { error } = await supabase.from('topics').insert([{ name, description }]);
    if(error) console.error("Error adding topic:", error);
  }, []);
  
  const handleToggleSubscription = useCallback(async (topic: Topic) => {
    if(!session) return;

    try {
      if(topic.subscribed && topic.subscription_id) {
        const { error } = await supabase.from('topic_subscriptions').delete().eq('id', topic.subscription_id);
        if(error) {
          console.error("Error unsubscribing:", error);
          return;
        } 
        
        if (isPushEnabled) {
          try {
            await oneSignalService.removeUserTags([`topic_${topic.id}`]);
            console.log(`Removed OneSignal tag for topic: ${topic.name}`);
          } catch (error) {
            console.warn('Error removing OneSignal tag (non-critical):', error);
          }
        }
      } else {
        const { error } = await supabase.from('topic_subscriptions').insert([{ user_id: session.user.id, topic_id: topic.id }]);
        if(error) {
          console.error("Error subscribing:", error);
          return;
        }
        
        if (isPushEnabled) {
          try {
            await oneSignalService.setUserTags({ [`topic_${topic.id}`]: '1' });
            console.log(`Added OneSignal tag for topic: ${topic.name}`);
          } catch (error) {
            console.warn('Error setting OneSignal tag (non-critical):', error);
          }
        }
      }
    } catch (error) {
      console.error('Error toggling subscription:', error);
      alert('Failed to update subscription. Please try again.');
    }
  }, [session, isPushEnabled]);

  const themeContextValue = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme]);

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

  let pageComponent;
  const commonProps = {
    onLogout: handleLogout,
    onNavigate: handleNavigate,
    setIsSidebarOpen,
    notifications,
    openSettings: () => setIsSettingsOpen(true),
    systemStatus,
    session,
  };

  switch (currentPage) {
    case 'dashboard':
      pageComponent = <DashboardPage 
        {...commonProps}
        topics={topics}
        onUpdateNotification={updateNotification}
        onAddComment={addComment}
      />;
      break;
    case 'api-docs':
      pageComponent = <ApiDocsPage {...commonProps} />;
      break;
    case 'audit-logs':
      pageComponent = <AuditLogsPage {...commonProps} />;
      break;
    case 'how-it-works':
      pageComponent = <HowItWorksPage {...commonProps} />;
      break;
    default:
      pageComponent = <DashboardPage 
        {...commonProps}
        topics={topics}
        onUpdateNotification={updateNotification}
        onAddComment={addComment}
      />;
      break;
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
              sendTestAlert={sendTestAlert}
              topics={topics}
              session={session}
              onAddTopic={handleAddTopic}
              onToggleSubscription={handleToggleSubscription}
            />
            <div className="flex-1 flex flex-col w-full">
              {pageComponent}
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

          {/* Debug Force Refresh Button - Remove in production */}
          {process.env.NODE_ENV === 'development' && (
            <button
              onClick={forceRefreshNotifications}
              className="fixed bottom-4 right-4 bg-blue-500 text-white px-3 py-1 rounded text-sm z-50 hover:bg-blue-600"
              title="Force refresh notifications (dev only)"
            >
              🔄 Force Refresh
            </button>
          )}
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
