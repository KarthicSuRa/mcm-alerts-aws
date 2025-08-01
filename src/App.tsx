/// <reference types="vite/client" />
import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  lazy,
  Suspense
} from 'react';
import {
  LandingPage,
  SupabaseLoginPage,
  DashboardPage,
  ApiDocsPage,
  AuditLogsPage,
  HowItWorksPage
} from './pages';
import {
  Sidebar,
  SettingsModal,
  NotificationToast,
  ErrorBoundary
} from './components';
import {
  Theme,
  Notification,
  SystemStatusData,
  Session,
  Comment,
  NotificationUpdatePayload,
  Topic,
  Database
} from './types';
import { supabase } from './lib/supabaseClient';
import { OneSignalService } from './lib/oneSignalService';
import { ThemeContext } from './contexts/ThemeContext';

const App = () => {
  const [theme, setTheme] = useState<Theme>('light');
  const [session, setSession] = useState<Session | null>(null);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [unauthedPage, setUnauthedPage] = useState<'landing' | 'login'>('landing');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [snoozedUntil, setSnoozedUntil] = useState<Date | null>(null);
  const [isPushEnabled, setIsPushEnabled] = useState(false);
  const [isPushLoading, setIsPushLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [toasts, setToasts] = useState<Notification[]>([]);

  const oneSignalService = useMemo(() => OneSignalService.getInstance(), []);
  const mountedRef = useRef(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    if (!session) return;

    const init = async () => {
      try {
        await oneSignalService.initialize();
        const subscribed = await oneSignalService.isSubscribed();
        setIsPushEnabled(subscribed);

        oneSignalService.onSubscriptionChange(setIsPushEnabled);
        oneSignalService.onNotificationClick((event) => {
          console.log('Notification clicked:', event);
        });

        if (subscribed) {
          await oneSignalService.savePlayerIdToDatabase(session.user.id);
        }
      } catch (err) {
        console.error('OneSignal init failed:', err);
      } finally {
        setIsPushLoading(false);
      }
    };

    init();
  }, [session, oneSignalService]);

  const handleNewNotification = useCallback((notification: Notification) => {
    if (snoozedUntil && new Date() < snoozedUntil) return;
    const topic = topics.find(t => t.id === notification.topic_id);
    if (!topic?.subscribed) return;

    addToast(notification);

    if (soundEnabled) {
      new Audio('/alert.wav').play().catch(console.error);
    }
  }, [topics, soundEnabled, snoozedUntil]);

  const addToast = useCallback((notification: Notification) => {
    setToasts(prev => [{ ...notification }, ...prev]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const fetchData = useCallback(async () => {
    if (!session || !mountedRef.current) return;

    try {
      const [{ data: notifs }, { data: comments }, { data: topics }, { data: subs }] = await Promise.all([
        supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('comments').select('*'),
        supabase.from('topics').select('*'),
        supabase.from('topic_subscriptions').select('*').eq('user_id', session.user.id)
      ]);

      const commentsMap = new Map<string, Comment[]>();
      comments?.forEach(c => {
        const arr = commentsMap.get(c.notification_id) || [];
        commentsMap.set(c.notification_id, [...arr, {
          ...c,
          user_email: c.user_id === session.user.id ? session.user.email ?? 'You' : 'User'
        }]);
      });

      const mergedNotifications = notifs?.map(n => ({
        ...n,
        comments: commentsMap.get(n.id) || []
      })) || [];

      const subTopicIds = new Set(subs?.map(s => s.topic_id));
      const enrichedTopics = topics?.map(topic => ({
        ...topic,
        subscribed: subTopicIds.has(topic.id),
        subscription_id: subs?.find(s => s.topic_id === topic.id)?.id
      })) || [];

      setNotifications(mergedNotifications);
      setTopics(enrichedTopics);
    } catch (err) {
      console.error('Fetch error:', err);
      setNotifications([]);
      setTopics([]);
    }
  }, [session]);

  useEffect(() => {
    if (!session) return;
    fetchData();

    const notifChannel = supabase
      .channel('public:notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, payload => {
        const newNotification = { ...payload.new, comments: [] } as Notification;
        setNotifications(prev => [newNotification, ...prev]);
        handleNewNotification(newNotification);
      })
      .subscribe();

    return () => {
      mountedRef.current = false;
      supabase.removeChannel(notifChannel);
    };
  }, [session, handleNewNotification, fetchData]);

  const themeContextValue = useMemo(() => ({
    theme,
    toggleTheme: () => setTheme(prev => (prev === 'light' ? 'dark' : 'light'))
  }), [theme]);

  const systemStatus: SystemStatusData = useMemo(() => ({
    service: 'Ready',
    database: 'Connected',
    push: 'OneSignal',
    subscription: isPushEnabled ? 'Active' : 'Inactive',
  }), [isPushEnabled]);

  const handleLogout = useCallback(async () => {
    if (session && isPushEnabled) {
      await oneSignalService.removePlayerIdFromDatabase(session.user.id).catch(console.error);
    }
    await supabase.auth.signOut();
    setUnauthedPage('landing');
  }, [session, isPushEnabled, oneSignalService]);

  const pageProps = {
    onLogout: handleLogout,
    onNavigate: setCurrentPage,
    setIsSidebarOpen,
    notifications,
    openSettings: () => setIsSettingsOpen(true),
    systemStatus,
    session
  };

  const pages: Record<string, JSX.Element> = {
    'dashboard': <DashboardPage {...pageProps} topics={topics} />,
    'api-docs': <ApiDocsPage {...pageProps} />,
    'audit-logs': <AuditLogsPage {...pageProps} />,
    'how-it-works': <HowItWorksPage {...pageProps} />
  };

  if (!session) {
    return (
      <ThemeContext.Provider value={themeContextValue}>
        {unauthedPage === 'landing'
          ? <LandingPage onNavigate={() => setUnauthedPage('login')} />
          : <SupabaseLoginPage />}
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
              onNavigate={setCurrentPage}
              isSidebarOpen={isSidebarOpen}
              setIsSidebarOpen={setIsSidebarOpen}
              sendTestAlert={() => {}} // Inject actual logic
              topics={topics}
              session={session}
              onAddTopic={() => {}}
              onToggleSubscription={() => {}}
            />
            <div className="flex-1 flex flex-col w-full">
              {pages[currentPage] ?? pages['dashboard']}
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
            onSubscribeToPush={() => {}}
            onUnsubscribeFromPush={() => {}}
          />
        </ErrorBoundary>

        <div aria-live="assertive" className="fixed inset-0 flex items-end px-4 py-6 pointer-events-none sm:p-6 sm:items-start z-[100]">
          <div className="w-full flex flex-col items-center space-y-4 sm:items-end">
            {toasts.map(toast => (
              <NotificationToast key={toast.id} notification={toast} onClose={() => removeToast(toast.id)} />
            ))}
          </div>
        </div>
      </div>
    </ThemeContext.Provider>
  );
};

export default App;
