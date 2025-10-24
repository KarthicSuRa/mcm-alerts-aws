
import React, { useState, useEffect, Dispatch, SetStateAction, useMemo } from 'react';
import { awsClient } from '../lib/awsClient';
import { Header } from '../components/layout/Header';
import { WebhookSource, Topic, Session, Notification, SystemStatusData } from '../types';
import { AddWebhookForm } from '../components/integrations/AddWebhookForm';
import { WebhookList } from '../components/integrations/WebhookList';
import { Icon } from '../components/ui/Icon';

interface IntegrationPageProps {
  session: Session;
  onLogout: () => Promise<void>;
  openSettings: () => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: Dispatch<SetStateAction<boolean>>;
  notifications: Notification[];
  systemStatus: SystemStatusData;
  onNavigate: (page: string) => void;
}

const IntegrationPage: React.FC<IntegrationPageProps> = ({
  session,
  onLogout,
  openSettings,
  isSidebarOpen,
  setIsSidebarOpen,
  notifications,
  systemStatus,
  onNavigate
}) => {
  const [webhooks, setWebhooks] = useState<WebhookSource[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWebhooks = async () => {
    try {
        const data = await awsClient.get('/webhook-sources');
        setWebhooks(data || []);
    } catch (error: any) {
        console.error("Error fetching webhooks:", error)
        setError(error.message)
    }
  };

  useEffect(() => {
    const fetchInitialData = async () => {
      if (!session) return;
      try {
        setLoading(true);
        await Promise.all([
            fetchWebhooks(),
            (async () => {
                const topicsData = await awsClient.get('/topics');
                setTopics(topicsData || []);
            })()
        ]);

      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, [session]);

  const enrichedWebhooks = useMemo(() => {
    const topicsMap = new Map(topics.map(t => [t.id, t.name]));
    return webhooks.map(webhook => {
      const topicName = webhook.topic_id ? topicsMap.get(webhook.topic_id) : undefined;
      return {
        ...webhook,
        topics: topicName ? { name: topicName } : null,
      };
    });
  }, [webhooks, topics]);

  const handleWebhookAdded = (newWebhook: WebhookSource) => {
    fetchWebhooks();
    setShowAddForm(false);
  };

  const handleDeleteWebhook = async (id: string) => {
    const originalWebhooks = [...webhooks];
    setWebhooks(webhooks.filter(wh => wh.id !== id));

    try {
        await awsClient.delete(`/webhook-sources/${id}`);
    } catch (error: any) {
        setError(`Failed to delete webhook: ${error.message}`);
        setWebhooks(originalWebhooks);
    }
  };

  return (
    <>
        <Header
            session={session}
            onLogout={onLogout}
            openSettings={openSettings}
            isSidebarOpen={isSidebarOpen}
            setIsSidebarOpen={setIsSidebarOpen}
            notifications={notifications}
            systemStatus={systemStatus}
            title="Integrations"
            onNavigate={onNavigate}
        />
        <main className="flex-1 overflow-y-auto bg-background md:ml-72">
            <div className="max-w-screen-2xl mx-auto p-4 sm:p-6 lg:p-8">
                <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold">Webhook Receiver</h1>
                <button
                    onClick={() => setShowAddForm(!showAddForm)}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg shadow hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all flex items-center gap-2"
                >
                    <Icon name={showAddForm ? "close" : "add"} className="w-5 h-5" />
                    <span>{showAddForm ? 'Cancel' : 'Add Webhook'}</span>
                </button>
                </div>

                {error && <p className="text-red-500 bg-red-100 p-3 rounded-md mb-4">Error: {error}</p>}

                <div className="p-6 bg-card rounded-xl border border-border">
                {showAddForm ? (
                    <AddWebhookForm 
                      topics={topics} 
                      session={session!} 
                      onAdd={handleWebhookAdded} 
                      onCancel={() => setShowAddForm(false)} 
                    />
                ) : (
                    <>
                    <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                        <Icon name="webhook" className="w-5 h-5" />
                        Your Webhooks
                    </h2>
                    {loading ? (
                        <p>Loading...</p>
                    ) : webhooks.length > 0 ? (
                        <WebhookList webhooks={enrichedWebhooks as (WebhookSource & { topics?: { name: string; } | null | undefined; })[]} onDelete={handleDeleteWebhook} />
                    ) : (
                        <div className="text-center py-8">
                            <p className="text-card-foreground/60">You haven't added any webhooks yet.</p>
                            <p className="text-card-foreground/50 text-sm mt-2">Click "Add Webhook" to get started.</p>
                        </div>
                    )}
                    </>
                )}
                </div>
            </div>
        </main>
    </>
  );
};

export default IntegrationPage;
