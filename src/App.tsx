import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { LandingPage } from './pages/LandingPage';
import { CognitoLoginPage } from './pages/CognitoLoginPage';
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
import { Theme, type Notification, Severity, NotificationStatus, SystemStatusData, Comment, NotificationUpdatePayload, Topic, MonitoredSite, User, Session } from './types';
import { awsClient } from './lib/awsClient';
import { OneSignalService } from './lib/oneSignalService';
import { ThemeContext } from './contexts/ThemeContext';
import { Routes, Route, useNavigate, useLocation, BrowserRouter } from 'react-router-dom';
import { SiteDetailPage } from './pages/monitoring/SiteDetailPage';
import UserManagementPage from './pages/UserManagementPage';
import SyntheticMonitoringPage from './pages/monitoring/SyntheticMonitoringPage';
import ErrorBoundary from './components/ui/ErrorBoundary';

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
  const [teams, setTeams] = useState<any[]>([]); // Define a proper type for Team
  const [toasts, setToasts] = useState<ExtendedNotification[]>([]);
  const [authLoading, setAuthLoading] = useState(true);
  const [sites, setSites] = useState<MonitoredSite[]>([]);
  const [loadingSites, setLoadingSites] = useState(true);
  const [sitesError, setSitesError] = useState<string | null>(null);
  const [userNames, setUserNames] = useState<Map<string, string>>(new Map());
  const navigate = useNavigate();
  const location = useLocation();
  const oneSignalService = OneSignalService.getInstance();
  const oneSignalInitialized = useRef(false);
  const dataFetched = useRef(false);
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
    setToasts(prev => {
      if (prev.some(n => n.id === notification.id)) return prev;
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
    if (snoozedUntil && new Date() < snoozedUntil) return;

    if (notification.topic_id) {
      const notificationTopic = topics.find(t => t.id === notification.topic_id);
      if (notificationTopic && !notificationTopic.subscribed) return;
    }

    addToast({ ...notification, id: `toast-${notification.id}-${Date.now()}` });

    if (soundEnabled) {
      try {
        const audio = new Audio('/alert.wav');
        await audio.play();
      } catch (error) {
        console.error("Error playing sound:", error);
      }
    }
  }, [soundEnabled, snoozedUntil, topics, addToast]);

  useEffect(() => {
    handleNewNotificationRef.current = handleNewNotification;
  }, [handleNewNotification]);

  // WebSocket Connection
  useEffect(() => {
    if (!session) return;

    const handleWebSocketMessage = (data: any) => {
      console.log('WebSocket message received:', data);
      if (data.type === 'NEW_NOTIFICATION') {
        const newNotification = data.payload as ExtendedNotification;
        setNotifications(prev => [newNotification, ...prev]);
        handleNewNotificationRef.current?.(newNotification);
      } else if (data.type === 'UPDATE_NOTIFICATION') {
        const updatedNotification = data.payload as ExtendedNotification;
        setNotifications(prev => prev.map(n => n.id === updatedNotification.id ? updatedNotification : n));
      }
    };

    const closeWebSocket = awsClient.connectWebSocket(handleWebSocketMessage);

    return () => {
      closeWebSocket();
    };
  }, [session]);

  // Auth Effect
useEffect(() => {
    const unsubscribe = awsClient.onAuthStateChange((cognitoSession, user) => {
        if (cognitoSession && user) {
            setSession({ access_token: cognitoSession.getAccessToken().getJwtToken(), user });
        } else {
            setSession(null);
            dataFetched.current = false;
            oneSignalInitialized.current = false;
            setNotifications([]);
            setTopics([]);
            setToasts([]);
            setSites([]);
            setIsPushEnabled(false);
            setIsPushLoading(false);
            navigate('/', { replace: true });
        }
        setAuthLoading(false);
    });
    return unsubscribe;
}, [navigate]);

  // OneSignal Initialization
  useEffect(() => {
    if (!session || oneSignalInitialized.current) return;

    oneSignalInitialized.current = true;
    const initOneSignal = async () => {
      try {
        await oneSignalService.initialize();
        await oneSignalService.login(session.access_token);
        const isSubscribed = await oneSignalService.isSubscribed();
        setIsPushEnabled(isSubscribed);
        oneSignalService.onSubscriptionChange(setIsPushEnabled);
        oneSignalService.setupForegroundNotifications((notification) => handleNewNotificationRef.current!(notification));
      } catch (error) {
        console.error('Failed to initialize OneSignal:', error);
        oneSignalInitialized.current = false;
      }
    };

    initOneSignal();
  }, [session, oneSignalService]);

  // Data Fetching
  useEffect(() => {
    if (!session || dataFetched.current || authLoading) return;

    const fetchInitialData = async () => {
      try {
        dataFetched.current = true;

        const [notificationsData, topicsData, teamsData, sitesData] = await Promise.all([
          awsClient.get('/notifications'),
          awsClient.get('/topics'),
          awsClient.get('/teams'),
          awsClient.get('/sites'),
        ]);

        setNotifications(notificationsData);
        setTopics(topicsData);
        setTeams(teamsData);
        setSites(sitesData);

      } catch (error) {
        console.error('Error fetching initial data:', error);
        setSitesError('Failed to load sites.');
        dataFetched.current = false;
      } finally {
        setLoadingSites(false);
      }
    };

    fetchInitialData();
  }, [session, authLoading]);

  const handleNavigate = useCallback((page: string) => {
    if (session) {
      navigate(`/${page}`);
    }
    setIsSidebarOpen(false);
  }, [session, navigate]);

  const handleLogout = useCallback(async () => {
    try {
      await oneSignalService.logout();
    } catch (error) {
      console.error('Error logging out from OneSignal:', error);
    }
    awsClient.signOut();
  }, [oneSignalService]);

  const onUpdateNotification = useCallback(async (notificationId: string, updates: NotificationUpdatePayload) => {
    try {
        const updatedNotification = await awsClient.put(`/notifications/${notificationId}`, updates);
        setNotifications(prev => prev.map(n => n.id === notificationId ? updatedNotification : n));
    } catch (error) {
        console.error('Failed to update notification:', error);
        // Optionally show an error to the user
    }
  }, []);

  const addComment = useCallback(async (notificationId: string, text: string) => {
    try {
      const newComment = await awsClient.post(`/notifications/${notificationId}/comments`, { text });
      setNotifications(prev => prev.map(n => 
        n.id === notificationId 
          ? { ...n, comments: [...(n.comments || []), newComment] } 
          : n
      ));
    } catch (error) {
      console.error('Failed to add comment:', error);
    }
  }, []);

  const handleAddTopic = useCallback(async (name: string, description: string, team_id: string | null) => {
    try {
      const newTopic = await awsClient.post('/topics', { name, description, team_id });
      setTopics(prev => [...prev, newTopic]);
    } catch (error) {
      console.error('Failed to add topic:', error);
    }
  }, []);

  const handleToggleSubscription = useCallback(async (topic: Topic) => {
    try {
      const updatedTopic = await awsClient.post(`/topics/${topic.id}/subscription`, { subscribe: !topic.subscribed });
      setTopics(prev => prev.map(t => t.id === topic.id ? updatedTopic : t));
    } catch (error) {
      console.error('Failed to toggle subscription:', error);
    }
  }, []);

  const handleDeleteTopic = useCallback(async (topic: Topic) => {
    try {
      await awsClient.post(`/topics/${topic.id}/delete`, {}); // Corrected to use POST as per convention for actions
      setTopics(prev => prev.filter(t => t.id !== topic.id));
    } catch (error) {
      console.error('Failed to delete topic:', error);
    }
  }, []);

  const handleUpdateTopicTeam = useCallback(async (topicId: string, teamId: string | null) => {
    try {
      await awsClient.put(`/topics/${topicId}/team`, { teamId });
      // Optionally refetch topics or update state optimistically
      const topicsData = await awsClient.get('/topics');
      setTopics(topicsData);
    } catch (error) {
      console.error('Failed to update topic team:', error);
    }
  }, []);

  const handleClearLogs = useCallback(async () => {
    try {
      await awsClient.post('/notifications/clear', {});
      setNotifications([]);
      setToasts([]);
    } catch (error) {
      console.error('Failed to clear logs:', error);
    }
  }, []);

  const sendTestAlert = useCallback(async () => {
    try {
      await awsClient.post('/notifications/test', {});
    } catch (error) {
      console.error('Failed to send test alert:', error);
    }
  }, []);

  const subscribeToPush = useCallback(async () => {
    setIsPushLoading(true);
    try {
      await oneSignalService.subscribe();
      setIsPushEnabled(true);
    } catch (error) {
      console.error('Failed to subscribe to push:', error);
    } finally {
      setIsPushLoading(false);
    }
  }, [oneSignalService]);

  const unsubscribeFromPush = useCallback(async () => {
    setIsPushLoading(true);
    try {
      await oneSignalService.unsubscribe();
      setIsPushEnabled(false);
    } catch (error) {
      console.error('Failed to unsubscribe from push:', error);
    } finally {
      setIsPushLoading(false);
    }
  }, [oneSignalService]);

  const toggleTheme = useCallback(() => {
    setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
  }, []);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const themeContextValue = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme]);

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!session) {
    return (
      <ThemeContext.Provider value={themeContextValue}>
        { unauthedPage === 'landing' 
          ? <LandingPage onNavigate={() => setUnauthedPage('login')} />
          : <CognitoLoginPage />
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
              profile={session.user}
            />
            <div className="flex-1 flex flex-col w-full">
              <Routes>
                <Route path="/" element={
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
                    onUpdateNotification={onUpdateNotification}
                    onAddTopic={handleAddTopic}
                    onToggleSubscription={handleToggleSubscription}
                    onDeleteTopic={handleDeleteTopic}
                    sites={sites}
                    onAddComment={addComment}
                  />
                } />
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
                <Route path="*" element={<DashboardPage onLogout={handleLogout} onNavigate={handleNavigate} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} notifications={notifications} openSettings={() => setIsSettingsOpen(true)} systemStatus={systemStatus} session={session} topics={topics} onUpdateNotification={onUpdateNotification} onAddTopic={handleAddTopic} onToggleSubscription={handleToggleSubscription} onDeleteTopic={handleDeleteTopic} sites={sites} onAddComment={addComment} />} />
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

const AppWrapper = () => (
  <BrowserRouter>
    <App />
  </BrowserRouter>
);

export default AppWrapper;
