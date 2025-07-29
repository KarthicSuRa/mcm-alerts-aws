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

  const addToast = (notification: Notification) => {
    setToasts(prev => [{...notification}, ...prev]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const systemStatus: SystemStatusData = useMemo(() => ({
    service: 'Ready',
    database: 'Connected',
    push: 'Supported',
    subscription: 'Active',
  }), []);

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

  // --- Handle New Notifications (Sound & Toast) ---
  const handleNewNotification = useCallback((notification: Notification) => {
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
      const audio = new Audio('https://cdn.freesound.org/previews/511/511485_6102149-lq.mp3');
      audio.play().catch(e => console.error("Error playing sound:", e));
    }

    // Show browser push notification if supported and user has granted permission
    if ('Notification' in window && globalThis.Notification.permission === 'granted') {
      try {
        new globalThis.Notification(notification.title || 'New Alert', {
          body: notification.message || 'You have a new notification',
          icon: '/favicon.ico', // You can customize this
          badge: '/favicon.ico',
          tag: notification.id, // Prevents duplicate notifications
          requireInteraction: notification.severity === 'high',
          silent: !soundEnabled,
        });
      } catch (error) {
        console.error('Error showing browser notification:', error);
      }
    }
  }, [soundEnabled, snoozedUntil, topics, addToast]);

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
  }, [session]);
  
  // --- Push Notification Subscription Effect ---
  const saveSubscription = useCallback(async (subscription: PushSubscription) => {
    if (!session) return;
    const { endpoint, keys } = subscription.toJSON();
    
    const subData: Database['public']['Tables']['push_subscriptions']['Insert'] = {
        user_id: session.user.id,
        endpoint: endpoint || '',
        keys: {
            p256dh: keys!.p256dh!,
            auth: keys!.auth!,
        },
    };

    const { error } = await supabase.from('push_subscriptions').upsert(subData, { onConflict: 'endpoint' });

    if (error) {
        console.error('Error saving push subscription:', error);
        throw error;
    }
  }, [session]);
  
  useEffect(() => {
    if (!session || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setIsPushLoading(false);
      return;
    }
    
    const checkSubscription = async () => {
        setIsPushLoading(true);
        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();
            if (subscription) {
                setIsPushEnabled(true);
                await saveSubscription(subscription);
            } else {
                setIsPushEnabled(false);
            }
        } catch (error) {
            console.error('Error checking push subscription:', error);
            setIsPushEnabled(false);
        } finally {
            setIsPushLoading(false);
        }
    };
    checkSubscription();
  }, [session, saveSubscription]);

  const urlBase64ToUint8Array = (base64String: string) => {
      const padding = "=".repeat((4 - base64String.length % 4) % 4);
      const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
      const rawData = window.atob(base64);
      const outputArray = new Uint8Array(rawData.length);
      for (let i = 0; i < rawData.length; ++i) {
          outputArray[i] = rawData.charCodeAt(i);
      }
      return outputArray;
  };

  const subscribeToPush = async () => {
    const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) {
      console.error('VITE_VAPID_PUBLIC_KEY not found in .env. Cannot subscribe to push notifications.');
      alert('Push notification setup is incomplete on the server. Please contact an administrator.');
      return;
    }
    if (!session) return;
    setIsPushLoading(true);

    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
        
        await saveSubscription(subscription);
        setIsPushEnabled(true);
    } catch (error) {
        console.error('Failed to subscribe to push notifications:', error);
        setIsPushEnabled(false);
        if (globalThis.Notification.permission === 'denied') {
             alert("Notification permission was denied. Please enable it in your browser settings to receive push alerts.");
        }
    } finally {
        setIsPushLoading(false);
    }
  };
  
  const unsubscribeFromPush = async () => {
      setIsPushLoading(true);
      try {
          const registration = await navigator.serviceWorker.ready;
          const subscription = await registration.pushManager.getSubscription();
          if (subscription) {
              await subscription.unsubscribe();
              await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint);
              setIsPushEnabled(false);
          }
      } catch (error) {
          console.error('Failed to unsubscribe from push:', error);
      } finally {
          setIsPushLoading(false);
      }
  }

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
    await supabase.auth.signOut();
    setUnauthedPage('landing');
  };

  const handleNavigate = (page: string) => {
    if (session) {
      setCurrentPage(page);
    }
    setIsSidebarOpen(false); // Close sidebar on navigation
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
    
    // The alert is created on the backend, which now triggers a push notification.
    // We only need to show a local toast and play a sound if the app is active.
    const { error } = await supabase.functions.invoke('create-notification', {
        body: newAlert,
    });
    
    if (error) {
        console.error("Error sending test alert:", error);
        alert(`Failed to send test alert: ${error.message}`);
    } else {
        addToast({ ...newAlert, id: `toast-${Date.now()}`, comments: [], created_at: new Date().toISOString() } as Notification);
        if (soundEnabled) {
            const audio = new Audio('https://cdn.freesound.org/previews/511/511485_6102149-lq.mp3');
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
        if(error) console.error("Error unsubscribing:", error);
    } else {
        // Subscribe
        const { error } = await supabase.from('topic_subscriptions').insert([{ user_id: session.user.id, topic_id: topic.id }]);
        if(error) console.error("Error subscribing:", error);
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
