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
import { Theme, Notification as AppNotification, Severity, NotificationStatus, SystemStatusData, Session, Comment, NotificationUpdatePayload, Topic, Database } from './types';
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

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [toasts, setToasts] = useState<AppNotification[]>([]);

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
            setNotifications(transformedData as AppNotification[]);
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
            const newNotification = {...payload.new, comments: [] } as AppNotification;
            setNotifications(prev => [newNotification, ...prev]);
        })
        .on<NotificationFromDB>('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications' }, payload => {
            setNotifications(prev => prev.map(n => n.id === payload.new.id ? {...n, ...payload.new} as AppNotification : n));
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

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const addToast = (notification: AppNotification) => {
    setToasts(prev => [{...notification}, ...prev]);
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
    }

    const newAlert: Database['public']['Tables']['notifications']['Insert'] = {
        type: 'server_alert',
        title: `Test Alert: High Priority${topicName}`,
        message: 'Testing the functionality.',
        severity: 'high',
        status: 'new',
        timestamp: new Date().toISOString(),
        site: 'prod-web-01',
        topic_id: topicId,
    };
    
    const { data, error } = await supabase.from('notifications').insert([newAlert]).select().single();
    
    if (error) {
        console.error("Error sending test alert:", error);
    } else if (data) {
        const newNotification = data as NotificationFromDB;
        addToast({ ...newNotification, comments: [] });

        if (soundEnabled) {
            const audio = new Audio('https://cdn.freesound.org/previews/511/511485_6102149-lq.mp3');
            audio.play().catch(e => console.error("Error playing sound:", e));
        }

        if (window.Notification && Notification.permission === 'granted') {
            new window.Notification('New MCM Alert', {
                body: `${newNotification.title}: ${newNotification.message}`,
                icon: '/icons/icon-192x192.png' 
            });
        }
    }
  }, [soundEnabled, snoozedUntil, topics]);

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
