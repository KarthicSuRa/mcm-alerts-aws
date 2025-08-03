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

  const addToast = useCallback((notification: Notification) => {
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
          setIsPushEnabled(subscribed);
        });

        // Set up notification click listener (only once)
        oneSignalService.onNotificationClick((event: any) => {
          console.log('OneSignal notification clicked:', event);
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
  }, []); // Empty dependency array - only run once

  // --- Handle New Notifications (FIXED: Memoized properly) ---
  const handleNewNotification = useCallback(async (notification: Notification) => {
    // Check if notifications are snoozed
    if (snoozedUntil && new Date() < snoozedUntil) {
      console.log("Alerts are snoozed. Notification sound/toast blocked.");
      return;
    }

    // Check if user is subscribed to this topic
    const notificationTopic = topics.find(t => t.id === notification.topic_id);
    if (notification.topic_id && (!notificationTopic || !notificationTopic.subscribed)) {
      console.log("User not subscribed to this topic. Notification sound/toast blocked.");
      return;
    }

    // Show toast notification
    addToast(notification);

    // Play sound if enabled
    if (soundEnabled) {
      const audio = new Audio('/alert.wav');
      audio.play().catch(e => console.error("Error playing sound:", e));
    }
  }, [soundEnabled, snoozedUntil, topics, addToast]);

  // --- Improved Data Fetching and Realtime Subscriptions ---
  useEffect(() => {
    if (!session || dataFetched.current) return;
    
    let mounted = true;
    const channels = new Map(); // Use Map to track channels by name
    let subscriptionTimeout: NodeJS.Timeout | undefined;

    const fetchInitialData = async () => {
      try {
        dataFetched.current = true;
        
        // Fetch notifications
        const { data: notificationsData, error: notificationsError } = await supabase
          .from('notifications')
          .select('*')
          .order('created_at', { ascending: false });

        if (notificationsError) {
          console.error('Error fetching notifications:', notificationsError);
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
            } else if (commentsError) {
              console.error('Error fetching comments:', commentsError);
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
          
          if (mounted) {
            setNotifications(transformedData as Notification[]);
          }
        }

        // Fetch topics and user subscriptions
        const [topicsResult, subscriptionsResult] = await Promise.all([
          supabase.from('topics').select('*'),
          supabase.from('topic_subscriptions').select('*').eq('user_id', session.user.id)
        ]);

        if (topicsResult.error || subscriptionsResult.error) {
          console.error('Error fetching topics/subscriptions:', topicsResult.error || subscriptionsResult.error);
          return;
        }

        if (topicsResult.data && subscriptionsResult.data && mounted) {
          const subscribedTopicIds = new Set(subscriptionsResult.data.map(sub => sub.topic_id));
          const mergedTopics = topicsResult.data.map(topic => ({
            ...topic,
            subscribed: subscribedTopicIds.has(topic.id),
            subscription_id: subscriptionsResult.data.find(s => s.topic_id === topic.id)?.id,
          }));
          setTopics(mergedTopics);
        }

      } catch (error) {
        console.error('Error in fetchInitialData:', error);
        dataFetched.current = false; // Allow retry
      }
    };

    const setupRealtimeSubscriptions = () => {
      // Add a small delay to ensure initial data is loaded first
      subscriptionTimeout = setTimeout(() => {
        if (!mounted) return;

        console.log('Setting up realtime subscriptions...');

        // FIXED: Notification channel with better UPDATE handling
        const notificationChannel = supabase
          .channel('notifications-channel', {
            config: {
              broadcast: { self: true }, // CHANGED: Allow self-triggered events
              presence: { key: session.user.id }
            }
          })
          .on<NotificationFromDB>('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'notifications' 
          }, payload => {
            if (!mounted) return;
            console.log('🔵 New notification received:', payload.new);
            const newNotification = {...payload.new, comments: [] } as Notification;
            setNotifications(prev => [newNotification, ...prev]);
            handleNewNotification(newNotification);
          })
          .on<NotificationFromDB>('postgres_changes', { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'notifications' 
          }, payload => {
            if (!mounted) return;
            console.log('🟡 Notification UPDATE received:', {
              id: payload.new.id,
              oldStatus: payload.old?.status,
              newStatus: payload.new.status,
              fullPayload: payload.new
            });
            
            setNotifications(prev => {
              const updated = prev.map(n => {
                if (n.id === payload.new.id) {
                  console.log('🟢 Updating notification in state:', {
                    id: n.id,
                    oldStatus: n.status,
                    newStatus: payload.new.status,
                    beforeUpdate: n,
                    afterUpdate: payload.new
                  });
                  
                  // FIXED: Ensure we merge properly and preserve all fields
                  const updatedNotification = {
                    ...n,           // Keep existing data (including comments)
                    ...payload.new, // Override with new data from database
                    comments: n.comments || [], // Ensure comments are preserved
                    // Explicitly ensure critical fields are updated
                    status: payload.new.status,
                    updated_at: payload.new.updated_at || new Date().toISOString()
                  } as Notification;
                  
                  console.log('🟢 Final updated notification:', updatedNotification);
                  return updatedNotification;
                }
                return n;
              });
              
              console.log('🔄 State updated, checking if notification exists in new state...');
              const updatedNotification = updated.find(n => n.id === payload.new.id);
              if (updatedNotification) {
                console.log('✅ Notification found in updated state with status:', updatedNotification.status);
              } else {
                console.log('❌ Notification NOT found in updated state!');
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

        channels.set('notifications', notificationChannel);

        // Comments channel
        const commentsChannel = supabase
          .channel('comments-channel', {
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
            console.log('New comment received:', payload.new);
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
              console.error('Comments channel subscription error:', err);
            } else {
              console.log('Comments channel status:', status);
            }
          });

        channels.set('comments', commentsChannel);
          
        // Topics channel
        const topicChannel = supabase
          .channel('topics-channel', {
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
            console.log('New topic received:', payload.new);
            setTopics(prev => [...prev, {...payload.new, subscribed: false} as Topic]);
          })
          .subscribe((status, err) => {
            if (err) {
              console.error('Topics channel subscription error:', err);
            } else {
              console.log('Topics channel status:', status);
            }
          });

        channels.set('topics', topicChannel);
          
        // Subscriptions channel
        const subscriptionChannel = supabase
          .channel('subscriptions-channel', {
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
            console.log('Subscription change:', payload);
            
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
              console.error('Subscriptions channel subscription error:', err);
            } else {
              console.log('Subscriptions channel status:', status);
            }
          });

        channels.set('subscriptions', subscriptionChannel);
      }, 1000); // 1 second delay
    };

    // Execute both functions
    fetchInitialData().then(() => {
      if (mounted) {
        setupRealtimeSubscriptions();
      }
    });

    return () => {
      console.log('Cleaning up realtime subscriptions...');
      mounted = false;
      
      // Clear timeout
      if (subscriptionTimeout) {
        clearTimeout(subscriptionTimeout);
      }
      
      // Clean up channels with proper error handling
      const cleanup = async () => {
        const channelPromises = Array.from(channels.values()).map(async (channel) => {
          try {
            if (channel && channel.state !== 'closed') {
              // First unsubscribe, then remove
              await channel.unsubscribe();
              await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
              await supabase.removeChannel(channel);
            }
          } catch (error) {
            console.warn('Error cleaning up channel:', error);
            // Don't throw, just log the warning
          }
        });
        
        try {
          await Promise.allSettled(channelPromises);
        } catch (error) {
          console.warn('Some channels failed to cleanup properly:', error);
        }
      };
      
      cleanup();
    };
  }, [session, handleNewNotification]);

  // --- Enhanced OneSignal Push Subscription Management (FIXED: Better error handling) ---
  const subscribeToPush = useCallback(async () => {
    if (!session) return;
    setIsPushLoading(true);

    try {
      console.log('🔔 Starting push subscription process...');
      
      // First subscribe to OneSignal
      const playerId = await oneSignalService.subscribe();
      if (!playerId) {
        throw new Error('Failed to get player ID from OneSignal');
      }
      
      console.log('🔔 OneSignal subscription successful, player ID:', playerId);
      
      // Save player ID to database
      await oneSignalService.savePlayerIdToDatabase(session.user.id);
      console.log('🔔 Player ID saved to database');
      
      // Wait a bit more before setting tags to ensure player is fully registered
      console.log('🔔 Waiting for player registration to complete...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Set user tags based on subscribed topics (with better error handling)
      const subscribedTopics = topics.filter(t => t.subscribed);
      if (subscribedTopics.length > 0) {
        console.log('🔔 Setting tags for subscribed topics:', subscribedTopics.map(t => t.name));
        
        try {
          const tags: Record<string, string> = {};
          subscribedTopics.forEach(topic => {
            // Use simpler tag format
            tags[`topic_${topic.id}`] = '1';
          });
          
          console.log('🔔 Tags to set:', tags);
          await oneSignalService.setUserTags(tags);
          console.log('🔔 Tags set successfully');
        } catch (tagError) {
          console.error('🔔 Failed to set tags (non-critical):', tagError);
          // Don't fail the whole subscription process for tag errors
        }
      }
      
      setIsPushEnabled(true);
      console.log('🔔 Push notifications enabled successfully');
      
    } catch (error) {
      console.error('🔔 Failed to subscribe to push notifications:', error);
      
      // Provide more specific error messages
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

  // Theme effect (unchanged)
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // DEBUG: Add this effect to track notification state changes
  useEffect(() => {
    const handleNotificationUpdate = (event: CustomEvent) => {
      console.log('🎯 Custom notification update event received:', event.detail);
    };
    
    window.addEventListener('notification-updated', handleNotificationUpdate as EventListener);
    
    return () => {
      window.removeEventListener('notification-updated', handleNotificationUpdate as EventListener);
    };
  }, []);

  // DEBUG: Log notifications state changes
  useEffect(() => {
    console.log('📊 Notifications state updated. Current notifications:', {
      total: notifications.length,
      byStatus: {
        new: notifications.filter(n => n.status === 'new').length,
        acknowledged: notifications.filter(n => n.status === 'acknowledged').length,
        resolved: notifications.filter(n => n.status === 'resolved').length
      },
      recentUpdates: notifications
        .filter(n => n.updated_at && new Date(n.updated_at).getTime() > Date.now() - 10000) // Last 10 seconds
        .map(n => ({ id: n.id, status: n.status, updated_at: n.updated_at }))
    });
  }, [notifications]);
  
  const handleUnauthedNavigate = useCallback((page: 'landing' | 'login') => {
    setUnauthedPage(page);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
  }, []);

  const handleLogout = useCallback(async () => {
    // Unsubscribe from push notifications on logout
    if (isPushEnabled && session) {
      try {
        await oneSignalService.removePlayerIdFromDatabase(session.user.id);
      } catch (error) {
        console.error('Error removing player ID on logout:', error);
      }
    }
    
    // Reset data fetch flag
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
    
    const { error } = await supabase.functions.invoke('hyper-worker', {
      body: newAlert,
    });
    
    if (error) {
      console.error("Error sending test alert:", error);
      alert(`Failed to send test alert: ${error.message}`);
    } else {
      addToast({ ...newAlert, id: `toast-${Date.now()}`, comments: [], created_at: new Date().toISOString() } as Notification);
      if (soundEnabled) {
        const audio = new Audio('/alert.wav');
        audio.play().catch(e => console.error("Error playing sound:", e));
      }
    }
  }, [soundEnabled, snoozedUntil, topics, addToast]);

  // FIXED: Made functions async and added proper error handling
  const updateNotification = useCallback(async (notificationId: string, updates: NotificationUpdatePayload) => {
    console.log('🔧 Updating notification:', { notificationId, updates });
    
    try {
      // IMPORTANT: Add .select() to get the updated data back
      const { error, data } = await supabase
        .from('notifications')
        .update(updates)
        .eq('id', notificationId)
        .select()
        .single(); // Get the single updated record
      
      if (error) {
        console.error("❌ Error updating notification:", error);
        throw error;
      }
      
      console.log('✅ Notification updated successfully:', data);
      
      // FALLBACK: Update local state immediately if real-time doesn't work
      // This ensures the UI updates even if real-time subscriptions have issues
      setNotifications(prev => prev.map(n => {
        if (n.id === notificationId) {
          console.log('🔄 Fallback: Updating notification in local state');
          return {
            ...n,
            ...updates,
            // Preserve comments and other data that might not be in updates
            comments: n.comments || []
          } as Notification;
        }
        return n;
      }));
      
    } catch (error) {
      console.error("❌ Failed to update notification:", error);
      throw error; // Re-throw to let the calling component handle it
    }
  }, []);

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
      
      // FALLBACK: Update local state immediately
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
  
  // Enhanced topic subscription handler to be more robust
  const handleToggleSubscription = useCallback(async (topic: Topic) => {
    if(!session) return;

    try {
      if(topic.subscribed && topic.subscription_id) {
        // Unsubscribe
        const { error } = await supabase.from('topic_subscriptions').delete().eq('id', topic.subscription_id);
        if(error) {
          console.error("Error unsubscribing:", error);
          return;
        } 
        
        // Remove OneSignal tag (non-blocking)
        if (isPushEnabled) {
          try {
            await oneSignalService.removeUserTags([`topic_${topic.id}`]);
            console.log(`Removed OneSignal tag for topic: ${topic.name}`);
          } catch (error) {
            console.warn('Error removing OneSignal tag (non-critical):', error);
          }
        }
      } else {
        // Subscribe
        const { error } = await supabase.from('topic_subscriptions').insert([{ user_id: session.user.id, topic_id: topic.id }]);
        if(error) {
          console.error("Error subscribing:", error);
          return;
        }
        
        // Add OneSignal tag (non-blocking)
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
