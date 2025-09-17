import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { WebhookSource, Topic, Session } from '../types';
import { AddWebhookForm } from '../components/integrations/AddWebhookForm';
import { WebhookList } from '../components/integrations/WebhookList';
import { Icon } from '../components/ui/Icon';

const IntegrationPage: React.FC = () => {
  const [webhooks, setWebhooks] = useState<WebhookSource[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Function to fetch webhooks with their linked topic names
  const fetchWebhooks = async () => {
    const { data, error } = await supabase
      .from('webhook_sources')
      // Join with the topics table to get the topic name
      .select(`
        *,
        topics ( name )
      `)
      .order('created_at', { ascending: false });
    
    if (error) {
        console.error("Error fetching webhooks:", error)
        setError(error.message)
    } else {
        setWebhooks(data || []);
    }
  };

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoading(true);
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw new Error('Could not retrieve user session.');
        if (!sessionData.session) throw new Error('You must be logged in.');
        setSession(sessionData.session);

        // Fetch webhooks and topics in parallel
        await Promise.all([
            fetchWebhooks(),
            (async () => {
                const { data: topicsData, error: topicsError } = await supabase.from('topics').select('*');
                if (topicsError) throw topicsError;
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
  }, []);

  const handleWebhookAdded = (newWebhook: WebhookSource) => {
    // Refetch the list to show the newly added webhook with its topic
    fetchWebhooks();
    setShowAddForm(false);
  };

  const handleDeleteWebhook = async (id: string) => {
    const originalWebhooks = [...webhooks];
    setWebhooks(webhooks.filter(wh => wh.id !== id));

    const { error } = await supabase.from('webhook_sources').delete().eq('id', id);

    if (error) {
      setError(`Failed to delete webhook: ${error.message}`);
      setWebhooks(originalWebhooks); // Revert on failure
    }
  };

  return (
    <div className="flex-1 p-4 sm:p-6 bg-background text-foreground">
      <main className="max-w-7xl mx-auto">
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
                  <WebhookList webhooks={webhooks} onDelete={handleDeleteWebhook} />
              ) : (
                  <div className="text-center py-8">
                    <p className="text-card-foreground/60">You haven't added any webhooks yet.</p>
                    <p className="text-card-foreground/50 text-sm mt-2">Click "Add Webhook" to get started.</p>
                  </div>
              )}
            </>
          )}
          </div>
      </main>
    </div>
  );
};

export default IntegrationPage;
