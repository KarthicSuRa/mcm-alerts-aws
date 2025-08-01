import { useCallback, useEffect, useRef, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Session } from "@supabase/supabase-js";
import { supabase } from "./utils/supabaseClient";
import OneSignal from "react-onesignal";
import { Notification, Toast } from "./types";

import { LandingPage } from "./pages/LandingPage";
import { SupabaseLoginPage } from "./pages/SupabaseLoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ApiDocsPage } from "./pages/ApiDocsPage";
import { AuditLogsPage } from "./pages/AuditLogsPage";
import { HowItWorksPage } from "./pages/HowItWorksPage";

import { Sidebar } from "./components/layout/Sidebar";
import { SettingsModal } from "./components/layout/SettingsModal";
import { NotificationToast } from "./components/ui/NotificationToast";
import ErrorBoundary from "./components/ui/ErrorBoundary";

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const isOneSignalInitialized = useRef(false);

  const handleNewNotification = useCallback((notification: Notification) => {
    const toast: Toast = {
      id: notification.id,
      title: notification.title,
      description: notification.message,
      type: notification.priority,
    };
    setToasts(prev => [toast, ...prev]);
  }, []);

  const addToast = useCallback((toast: Toast) => {
    setToasts(prev => [toast, ...prev]);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session || !session.user?.id) return;

    const userId = session.user.id;

    const initOneSignal = async () => {
      if (isOneSignalInitialized.current) return;

      await OneSignal.init({
        appId: import.meta.env.VITE_ONESIGNAL_APP_ID,
        notifyButton: { enable: true },
        allowLocalhostAsSecureOrigin: true,
      });
      await OneSignal.login(userId);
      isOneSignalInitialized.current = true;
    };

    initOneSignal();

    const notifChannel = supabase
      .channel("custom-all-channel")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
        },
        (payload) => {
          if (
            payload.new &&
            "id" in payload.new &&
            "title" in payload.new &&
            "message" in payload.new &&
            "type" in payload.new &&
            "priority" in payload.new
          ) {
            const newNotification: Notification = {
              ...(payload.new as Notification),
              comments: [],
            };
            setNotifications(prev => [newNotification, ...prev]);
            handleNewNotification(newNotification);
          }
        }
      )
      .subscribe();

    const topicChannel = supabase
      .channel("topics-channel")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "topics",
        },
        (payload) => {
          const newTopic = payload.new.name;
          setTopics(prev =>
            prev.includes(newTopic) ? prev : [newTopic, ...prev]
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(notifChannel);
      supabase.removeChannel(topicChannel);
    };
  }, [session, handleNewNotification]);

  return (
    <ErrorBoundary>
      <div className="flex h-screen overflow-hidden bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white">
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        <main className="flex-1 overflow-y-auto p-4">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<SupabaseLoginPage />} />
            <Route path="/dashboard" element={
              <DashboardPage
                session={session}
                onSettingsClick={() => setIsSettingsOpen(true)}
                addToast={addToast}
                topics={topics}
              />
            } />
            <Route path="/api-docs" element={<ApiDocsPage />} />
            <Route path="/audit-logs" element={<AuditLogsPage />} />
            <Route path="/how-it-works" element={<HowItWorksPage />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
        <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
        <NotificationToast toasts={toasts} />
      </div>
    </ErrorBoundary>
  );
}

export default App;
