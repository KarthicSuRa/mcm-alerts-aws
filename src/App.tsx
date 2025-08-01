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

  const addToast = (notification: Notification) => {
    setToasts(prev => [{...notification}, ...prev]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

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

  // --- OneSignal Initialization ---
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
          // Handle notification click - could navigate to specific page
        });

        // If user is logged in and subscribed, save player ID to database
        if (session && isSubscribed) {
          await oneSignalService.savePlayerIdToDatabase(session.user.id);
        }
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

    // Show toast notification
    addToast(notification);

    // Play sound if enabled
    if (soundEnabled) {
      const audio = new Audio('/alert.wav');
      audio.play().catch(e => console.error("Error playing sound:", e));
    }
  }, [soundEnabled, snoozedUntil, topics]);

  // --- Data Fetching and Realtime Subscriptions ---
  useEffect(() => {
    if (session) {
      let isMounted = true; // Prevent state updates if component unmounts
      
      // Initial data fetch with proper error handling
      const fetchInitialData = async () => {
        try {
          console.log('Fetching initial data...');
          
          // Fetch notifications with timeout and error handling
          const { data: notificationsData, error: notificationsError } = await supabase
              .from('notifications')
              .select('*')
              .order('created_at', { ascending: false })
              .limit(100); // Add limit to prevent massive queries

          if (notificationsError) {
              console.error('Error fetching notifications:', notificationsError);
              // Set empty array instead of breaking
              if (isMounted) setNotifications([]);
          } else if (notificationsData && isMounted) {
              const notificationIds = notificationsData.map(n => n.id);
              const commentsByNotificationId = new Map<string, CommentFromDB[]>();

              // Only fetch comments if we have notifications
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
              
              if (isMounted) {
                setNotifications(transformedData as Notification[]);
              }
          } else {
              // No data found, set empty array
              if (isMounted) setNotifications([]);
          }

          // Fetch topics and user subscriptions with error handling
          const [topicsResult, subscriptionsResult] = await Promise.allSettled([
            supabase.from('topics').select('*'),
            supabase.from('topic_subscriptions').select('*').eq('user_id', session.user.id)
          ]);

          if (topicsResult.status === 'fulfilled' && subscriptionsResult.status === 'fulfilled') {
            const topicsData = topicsResult.value.data;
            const subscriptionsData = subscriptionsResult.value.data;
            
            if (topicsData && subscriptionsData && isMounted) {
                const subscribedTopicIds = new Set(subscriptionsData.map(sub => sub.topic_id));
                const mergedTopics = topicsData.map(topic => ({
                    ...topic,
                    subscribed: subscribedTopicIds.has(topic.id),
                    subscription_id: subscriptionsData.find(s => s.topic_id === topic.id)?.id,
                }));
                setTopics(mergedTopics);
            } else if (isMounted) {
                setTopics([]);
            }
          } else {
            console.error('Error fetching topics/subscriptions:', 
              topicsResult.status === 'rejected' ? (topicsResult as PromiseRejectedResult).reason : 
              (subscriptionsResult as PromiseRejectedResult).reason);
            if (isMounted) setTopics([]);
          }

          console.log('Initial data fetch completed');
          
        } catch (error) {
          console.error('Fatal error in fetchInitialData:', error);
          // Set default empty states
          if (isMounted) {
            setNotifications([]);
            setTopics([]);
          }
        }
      };

      fetchInitialData();
      
      // Set up realtime subscriptions with error handling
      try {
        const notificationChannel = supabase
          .channel('public:notifications')
          .on<NotificationFromDB>('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, payload => {
              if (isMounted && payload.new) {
                const newNotification = {...payload.new, comments: [] } as Notification;
                setNotifications(prev => [newNotification, ...prev]);
                handleNewNotification(newNotification);
              }
          })
          .on<NotificationFromDB>('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications' }, payload => {
              if (isMounted && payload.new) {
                setNotifications(prev => prev.map(n => n.id === payload.new.id ? {...n, ...payload.new} as Notification : n));
              }
          })
          .on<CommentFromDB>('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments' }, async (payload) => {
               if (isMounted && payload.new) {
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
               }
          })
          .subscribe();
          
        const topicChannel = supabase
          .channel('public:topics')
          .on<TopicFromDB>('postgres_changes', { event: 'INSERT', schema: 'public', table: 'topics' }, payload => {
              if (isMounted && payload.new) {
                setTopics(prev => [...prev, {...payload.new, subscribed: false} as Topic]);
              }
          })
          .subscribe();
          
        const subscriptionChannel = supabase
          .channel('public:topic_subscriptions')
          .on<SubscriptionFromDB>('postgres_changes', { event: '*', schema: 'public', table: 'topic_subscriptions', filter: `user_id=eq.${session.user.id}` }, (payload) => {
               if (!isMounted) return;
               
               if (payload.eventType === 'INSERT' && payload.new) {
                  const newSub = payload.new as SubscriptionFromDB;
                  setTopics(prev => prev.map(t => t.id === newSub.topic_id ? {...t, subscribed: true, subscription_id: newSub.id} : t));
               }
               if (payload.eventType === 'DELETE' && payload.old) {
                   const oldSub = payload.old as Partial<SubscriptionFromDB>;
                   if (oldSub?.topic_id) {
                      setTopics(prev => prev.map(t => t.id === oldSub.topic_id ? {...t, subscribed: false, subscription_id: undefined} : t));
                   }
               }
          })
          .subscribe();

        return () => {
          isMounted = false;
          supabase.removeChannel(notificationChannel);
          supabase.removeChannel(topicChannel);
          supabase.removeChannel(subscriptionChannel);
        };
      } catch (error) {
        console.error('Error setting up realtime subscriptions:', error);
      }
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
      alert('Failed to enable push notifications. Please try again.');
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
        addToast({ ...newAlert, id: `toast-${Date.now()}`, comments: [], created_at: new Date().toISOString() } as Notification);
        if (soundEnabled) {
            const audio = new Audio('/alert.wav');
            audio.play().catch(e => console.error("Error playing sound:", e));
        }
    }
  }, [soundEnabled, snoozedUntil, topics, session]);

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
    const { error } = await supabase.from('topics').insert([{ name, description }]);
    if(error) console.error("Error adding topic:", error);
  }
  
  const handleToggleSubscription = async (topic: Topic) => {
    if(!session) return;

    if(topic.subscribed && topic.subscription_id) {
        // Unsubscribe
        const { error } = await supabase.from('topic_subscriptions').delete().eq('id', topic.subscription_id);
        if(error) {
          console.error("Error unsubscribing:", error);
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
