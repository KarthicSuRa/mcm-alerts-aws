/// <reference types="vite/client" />

import React, { useState, useEffect, useMemo, useCallback } from 'react';
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

  const addToast = useCallback((notification: Notification) => {
    setToasts(prev => {
      // Check if toast already exists to prevent duplicates
      if (prev.some(t => t.id === notification.id)) {
        return prev;
      }
      return [{...notification}, ...prev];
    });
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

  // --- Auth Effect ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // --- OneSignal Initialization with Enhanced Mobile Support ---
  useEffect(() => {
    const initOneSignal = async () => {
      try {
        await oneSignalService.initialize();
        
        // Check if user is already subscribed
        const isSubscribed = await oneSignalService.isSubscribed();
        setIsPushEnabled(isSubscribed);
        
        // Set up subscription change listener
        oneSignalService.onSubscriptionChange((subscribed: boolean) => {
          setIsPushEnabled(subscribed);
        });

        // Set up notification click listener
        oneSignalService.onNotificationClick((event: any) => {
          console.log('OneSignal notification clicked:', event);
          handleNotificationIconClick();
        });

        // Set up custom event listener for mobile foreground notifications
        const handleMobileForegroundNotification = (event: CustomEvent) => {
          const notificationData = event.detail;
          console.log('Mobile foreground notification received:', notificationData);
          
          // Handle the notification like any other new notification
          handleNewNotification(notificationData);
        };

        window.addEventListener('oneSignalForegroundNotification', handleMobileForegroundNotification);

        // If user is logged in and subscribed, save player ID to database
        if (session && isSubscribed) {
          await oneSignalService.savePlayerIdToDatabase(session.user.id);
        }

        // Cleanup function
        return () => {
          window.removeEventListener('oneSignalForegroundNotification', handleMobileForegroundNotification);
        };
      } catch (error) {
        console.error('Failed to initialize OneSignal:', error);
      } finally {
        setIsPushLoading(false);
      }
    };

    initOneSignal();
  }, [session]);

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

    // Always show toast notification for both mobile and web browsers
    addToast(notification);

    // Play sound if enabled
    if (soundEnabled) {
      try {
        const audio = new Audio('/alert.wav');
        audio.volume = 0.5;
        
        // For mobile browsers, we need to handle audio play differently
        const playAudio = async () => {
          try {
            await audio.play();
          } catch (playError) {
            // If auto-play fails, try again with user interaction
            console.warn('Audio autoplay failed, will play on next user interaction:', playError);
            
            // Store audio for later play on user interaction
            const playOnInteraction = () => {
              audio.play().catch(e => console.error('Audio play failed:', e));
              document.removeEventListener('touchstart', playOnInteraction);
              document.removeEventListener('click', playOnInteraction);
            };
            
            document.addEventListener('touchstart', playOnInteraction, { once: true });
            document.addEventListener('click', playOnInteraction, { once: true });
          }
        };

        await playAudio();
      } catch (e) {
        console.error("Error playing sound:", e);
      }
    }

    // For mobile devices, also try to show a native notification if possible
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const nativeNotification = new Notification(notification.title, {
          body: notification.message,
          icon: '/icons/icon-192x192.png',
          tag: notification.id,
          requireInteraction: notification.severity === 'high',
          silent: !soundEnabled,
        });

        nativeNotification.onclick = () => {
          handleNotificationIconClick();
          nativeNotification.close();
        };

        // Auto-close after 10 seconds for non-critical notifications
        if (notification.severity !== 'high') {
          setTimeout(() => nativeNotification.close(), 10000);
        }
      } catch (error) {
        console.warn('Failed to show native notification:', error);
      }
    }
  }, [soundEnabled, snoozedUntil, topics, addToast]);

  // Handle notification icon click - navigate to most recent notification
  const handleNotificationIconClick = useCallback(() => {
    if (notifications.length > 0) {
      // Sort by created_at to get the most recent
      const mostRecentNotification = notifications.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0];
      
      // Navigate to dashboard if not already there
      if (currentPage !== 'dashboard') {
        setCurrentPage('dashboard');
      }
      
      // Mark the most recent notification as read if it's new
      if (mostRecentNotification.status === 'new') {
        updateNotification(mostRecentNotification.id, { status: 'acknowledged' });
      }
      
      // Close sidebar on mobile
      setIsSidebarOpen(false);
      
      console.log('Navigated to most recent notification:', mostRecentNotification.id);
    }
  }, [notifications, currentPage]);

  // --- Data Fetching and Realtime Subscriptions ---
  useEffect(() => {
    if (session) {
      // Initial data fetch
      const fetchInitialData = async () => {
        // Fetch notifications
        const { data: notificationsData, error: notificationsError } = await supabase
            .from('notifications')
            .select('*')
            .order('created_at', { ascending: false });

        if (notificationsError) {
            console.error('Error fetching notifications:', notificationsError);
        } else if (notificationsData) {
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
            setNotifications(transformedData as Notification[]);
        }

        // Fetch topics and user subscriptions
        const { data: topicsData, error: topicsError } = await supabase.from('topics').select('*');
        const { data: subscriptionsData, error: subscriptionsError } = await supabase.from('topic_subscriptions').select('*').eq('user_id', session.user.id);

        if (topicsError || subscriptionsError) {
            console.error('Error fetching topics/subscriptions:', topicsError || subscriptionsError);
        } else if (topicsData && subscriptionsData) {
            const subscribedTopicIds = new Set(subscriptionsData.map(sub => sub.topic_id));
            const mergedTopics = topicsData.map(topic => ({
                ...topic,
                subscribed: subscribedTopicIds.has(topic.id),
                subscription_id: subscriptionsData.find(s => s.topic_id === topic.id)?.id,
            }));
            setTopics(mergedTopics);
        }
      };

      fetchInitialData();
      
      // Set up realtime subscriptions
      const notificationChannel = supabase
        .channel('public:notifications')
        .on<NotificationFromDB>('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, payload => {
            const newNotification = {...payload.new, comments: [] } as Notification;
            setNotifications(prev => [newNotification, ...prev]);
            
            // Handle sound and toast for new notifications
            handleNewNotification(newNotification);
        })
        .on<NotificationFromDB>('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications' }, payload => {
            setNotifications(prev => prev.map(n => n.id === payload.new.id ? {...n, ...payload.new} as Notification : n));
        })
        .on<CommentFromDB>('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments' }, async (payload) => {
             const newCommentPayload = payload.new;
             const newComment = {
                ...newCommentPayload,
                user_email: newCommentPayload.user_id === session.user.id ? (session.user.email ?? 'Current User') : 'Another User'
             } as Comment;
             setNotifications(prev => prev.map(n => 
                n.id === newComment.notification_id 
                ? { ...n, comments: [...(n.comments || []), newComment].sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) } 
                : n
            ));
        })
        .subscribe();
        
      const topicChannel = supabase
        .channel('public:topics')
        .on<TopicFromDB>('postgres_changes', { event: 'INSERT', schema: 'public', table: 'topics' }, payload => {
            setTopics(prev => [...prev, {...payload.new, subscribed: false} as Topic]);
        })
        .subscribe();
        
      const subscriptionChannel = supabase
        .channel('public:topic_subscriptions')
        .on<SubscriptionFromDB>('postgres_changes', { event: '*', schema: 'public', table: 'topic_subscriptions', filter: `user_id=eq.${session.user.id}` }, (payload) => {
             if (payload.eventType === 'INSERT') {
                const newSub = payload.new as SubscriptionFromDB;
                setTopics(prev => prev.map(t => t.id === newSub.topic_id ? {...t, subscribed: true, subscription_id: newSub.id} : t));
             }
             if (payload.eventType === 'DELETE') {
                 const oldSub = payload.old as Partial<SubscriptionFromDB>;
                 if (oldSub?.topic_id) {
                    setTopics(prev => prev.map(t => t.id === oldSub.topic_id ? {...t, subscribed: false, subscription_id: undefined} : t));
                 }
             }
        })
        .subscribe();

      return () => {
        supabase.removeChannel(notificationChannel);
        supabase.removeChannel(topicChannel);
        supabase.removeChannel(subscriptionChannel);
      };
    }
  }, [session, handleNewNotification]);

  // --- OneSignal Push Subscription Management ---
  const subscribeToPush = async () => {
    if (!session) return;
    setIsPushLoading(true);

    try {
      const playerId = await oneSignalService.subscribe();
      if (playerId) {
        await oneSignalService.savePlayerIdToDatabase(session.user.id);
        
        // Set user tags based on subscribed topics
        const subscribedTopics = topics.filter(t => t.subscribed);
        if (subscribedTopics.length > 0) {
          const tags: Record<string, string> = {};
          subscribedTopics.forEach(topic => {
            tags[`topic_${topic.id}`] = 'true';
          });
          await oneSignalService.setUserTags(tags);
        }
        
        setIsPushEnabled(true);
      }
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      alert('Failed to enable push notifications. Please check your browser settings and try again.');
    } finally {
      setIsPushLoading(false);
    }
  };
  
  const unsubscribeFromPush = async () => {
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
  };

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);
  
  const handleUnauthedNavigate = (page: 'landing' | 'login') => {
    setUnauthedPage(page);
  };

  const toggleTheme = () => {
    setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  const handleLogout = async () => {
    // Unsubscribe from push notifications on logout
    if (isPushEnabled && session) {
      try {
        await oneSignalService.removePlayerIdFromDatabase(session.user.id);
      } catch (error) {
        console.error('Error removing player ID on logout:', error);
      }
    }
    
    await supabase.auth.signOut();
    setUnauthedPage('landing');
  };

  const handleNavigate = (page: string) => {
    if (session) {
      setCurrentPage(page);
    }
    setIsSidebarOpen(false);
  };
  
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
    
    const { error } = await supabase.functions.invoke('create-notification', {
        body: newAlert,
    });
    
    if (error) {
        console.error("Error sending test alert:", error);
        alert(`Failed to send test alert: ${error.message}`);
    } else {
        // Add toast for immediate feedback
        const toastNotification = { 
          ...newAlert, 
          id: `toast-${Date.now()}`, 
          comments: [], 
          created_at: new Date().toISOString() 
        } as Notification;
        
        addToast(toastNotification);
        
        if (soundEnabled) {
            try {
              const audio = new Audio('/alert.wav');
              audio.volume = 0.5;
              await audio.play();
            } catch (e) {
              console.error("Error playing sound:", e);
            }
        }
    }
  }, [soundEnabled, snoozedUntil, topics, session, addToast]);

  const updateNotification = async (notificationId: string, updates: NotificationUpdatePayload) => {
    const { error } = await supabase
      .from('notifications')
      .update(updates)
      .eq('id', notificationId);
    if(error) console.error("Error updating notification:", error);
  };
  
  const addComment = async (notificationId: string, text: string) => {
    if(!session) return;
    const { error } = await supabase
      .from('comments')
      .insert([{ notification_id: notificationId, text, user_id: session.user.id }]);
     if(error) console.error("Error adding comment:", error);
  }

  const handleAddTopic = async (name: string, description: string) => {
    try {
      const { error } = await supabase.from('topics').insert([{ name, description }]);
      if(error) {
        console.error("Error adding topic:", error);
        throw new Error(error.message);
      }
    } catch (error) {
      console.error("Error adding topic:", error);
      throw error;
    }
  }
  
  const handleToggleSubscription = async (topic: Topic) => {
    if(!session) return;

    try {
      if(topic.subscribed && topic.subscription_id) {
          // Unsubscribe
          const { error } = await supabase.from('topic_subscriptions').delete().eq('id', topic.subscription_id);
          if(error) {
            console.error("Error unsubscribing:", error);
            throw new Error(error.message);
          } else {
            // Remove OneSignal tag
            if (isPushEnabled) {
              try {
                await oneSignalService.removeUserTags([`topic_${topic.id}`]);
              } catch (error) {
                console.error('Error removing OneSignal tag:', error);
              }
            }
          }
      } else {
          // Subscribe
          const { error } = await supabase.from('topic_subscriptions').insert([{ user_id: session.user.id, topic_id: topic.id }]);
          if(error) {
            console.error("Error subscribing:", error);
            throw new Error(error.message);
          } else {
            // Add OneSignal tag
            if (isPushEnabled) {
              try {
                await oneSignalService.setUserTags({ [`topic_${topic.id}`]: 'true' });
              } catch (error) {
                console.error('Error setting OneSignal tag:', error);
              }
            }
          }
      }
    } catch (error) {
      console.error("Error toggling subscription:", error);
      throw error;
    }
  }

  const themeContextValue = useMemo(() => ({ theme, toggleTheme }), [theme]);

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
      onNotificationIconClick: handleNotificationIconClick,
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
      
      {/* Enhanced Toast notifications container - Enhanced for mobile */}
      <div 
        aria-live="assertive" 
        className="fixed inset-0 flex items-end px-4 py-6 pointer-events-none sm:p-6 sm:items-start z-[100]"
        style={{ 
          /* Ensure toasts appear above everything on mobile */ 
          zIndex: 9999,
          /* Prevent interference with mobile scrolling */
          touchAction: 'none'
        }}
      >
        <div className="w-full flex flex-col items-center space-y-4 sm:items-end">
            {toasts.map(toast => (
                <NotificationToast 
                  key={toast.id} 
                  notification={toast} 
                  onClose={() => removeToast(toast.id)} 
                />
            ))}
        </div>
      </div>
    </ThemeContext.Provider>
  );
}

export default App;
