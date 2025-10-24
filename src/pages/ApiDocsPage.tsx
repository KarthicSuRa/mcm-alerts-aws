import React, { useState } from 'react';
import { Header } from '../components/layout/Header';
import { Icon } from '../components/ui/Icon';
import { Notification, SystemStatusData, Session } from '../types';

interface ApiDocsPageProps {
  onNavigate: (page: string) => void;
  onLogout: () => Promise<void>;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  notifications: Notification[];
  openSettings: () => void;
  systemStatus: SystemStatusData;
  session: Session;
}

const CodeBlock: React.FC<{ code: string }> = ({ code }) => {
    const [copied, setCopied] = useState(false);
    const copyToClipboard = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="relative">
            <pre className="bg-secondary p-4 rounded-md text-sm text-left overflow-x-auto">
                <code className="text-foreground">{code}</code>
            </pre>
            <button onClick={copyToClipboard} className="absolute top-2 right-2 p-1.5 rounded-md bg-muted hover:bg-accent">
                <Icon name={copied ? 'check' : 'copy'} className="w-4 h-4 text-muted-foreground"/>
            </button>
        </div>
    );
};

export const ApiDocsPage: React.FC<ApiDocsPageProps> = ({ onNavigate, onLogout, isSidebarOpen, setIsSidebarOpen, notifications, openSettings, systemStatus, session }) => {
  const endpointUrl = 'https://1yag6oe04i.execute-api.us-east-1.amazonaws.com/prod/ingest';

  // Updated example to reflect new required fields
  const requestExample = JSON.stringify({
      topic_name: "Deployments",
      priority: "high",
      title: "Production Deploy Successful",
      message: "Version 2.1.0 has been deployed to production.",
      // Optional fields
      site: "prod-web-01",
      details: {
          commit: "a1b2c3d",
          author: "jane.doe@example.com"
      }
  }, null, 2);

  return (
    <>
        <Header onLogout={onLogout} notifications={notifications} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} openSettings={openSettings} systemStatus={systemStatus} session={session} onNavigate={onNavigate} />
        <main className="flex-1 overflow-y-auto bg-background md:ml-72">
           <div className="max-w-screen-2xl mx-auto p-4 sm:p-6 lg:p-8">
                <div className="flex items-center mb-8">
                    <button onClick={() => onNavigate('dashboard')} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 mr-4">
                        <Icon name="arrow-left" className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                    </button>
                    <div>
                        <h1 className="text-4xl font-bold">API Documentation</h1>
                        <p className="text-muted-foreground mt-1">Integration guide for MCM Alerts API</p>
                    </div>
                </div>
               
               <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-8">
                         {/* Overview */}
                        <div className="p-6 bg-card rounded-xl border border-border">
                            <h2 className="text-xl font-semibold mb-3 flex items-center gap-2"><Icon name="docs" className="w-5 h-5"/> Overview</h2>
                            <p className="text-card-foreground/80 mb-4">The MCM Alerts API allows you to send real-time notifications to subscribed users. Use this API to integrate with your monitoring systems, applications, or services.</p>
                            <div className="flex gap-2 flex-wrap">
                                 <span className="px-3 py-1 text-xs font-medium rounded-full bg-blue-500/10 text-blue-500">REST API</span>
                                 <span className="px-3 py-1 text-xs font-medium rounded-full bg-green-500/10 text-green-500">JSON</span>
                                 <span className="px-3 py-1 text-xs font-medium rounded-full bg-muted text-muted-foreground">No Auth Required</span>
                            </div>
                        </div>

                        {/* API Endpoint */}
                        <div className="p-6 bg-card rounded-xl border border-border">
                            <h2 className="text-xl font-semibold mb-3">API Endpoint</h2>
                            <div className="relative bg-secondary p-4 rounded-md">
                                <code className="text-sm"><span className="font-bold text-green-500">POST</span> {endpointUrl}</code>
                                <button onClick={() => navigator.clipboard.writeText(endpointUrl)} className="absolute top-1/2 right-3 -translate-y-1/2 p-1.5 rounded-md hover:bg-accent">
                                    <Icon name="copy" className="w-4 h-4 text-muted-foreground"/>
                                </button>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">Method: POST | Auth: None Required | Content-Type: application/json</p>
                        </div>

                        {/* Request Example */}
                        <div className="p-6 bg-card rounded-xl border border-border">
                            <h2 className="text-xl font-semibold mb-3">Request Payload</h2>
                             <div className="mt-4">
                                <p className="text-sm text-card-foreground/80 mb-4">
                                    Send a JSON object with the following fields. The alert will be sent to all users subscribed to the specified topic.
                                </p>
                                <CodeBlock code={requestExample} />
                             </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        {/* Quick Reference */}
                         <div className="p-6 bg-card rounded-xl border border-border">
                            <h3 className="text-lg font-semibold mb-4">Field Reference</h3>
                            <div className="space-y-4 text-sm">
                                <div>
                                    <h4 className="font-semibold mb-2">Required Fields</h4>
                                    <ul className="list-disc list-inside text-card-foreground/80 mt-1 space-y-1">
                                        <li><code className="text-xs bg-muted rounded px-1 py-0.5">topic_name</code>: The name of the topic to publish to.</li>
                                        <li><code className="text-xs bg-muted rounded px-1 py-0.5">priority</code>: <code className="text-xs">low</code>, <code className="text-xs">medium</code>, or <code className="text-xs">high</code>.</li>
                                        <li><code className="text-xs bg-muted rounded px-1 py-0.5">title</code>: The main title of the alert.</li>
                                        <li><code className="text-xs bg-muted rounded px-1 py-0.5">message</code>: The detailed body of the alert.</li>
                                    </ul>
                                </div>
                                <div>
                                    <h4 className="font-semibold mb-2">Optional Fields</h4>
                                    <ul className="list-disc list-inside text-card-foreground/80 mt-1 space-y-1">
                                        <li><code className="text-xs bg-muted rounded px-1 py-0.5">site</code>: A string identifying a specific server or site.</li>
                                        <li><code className="text-xs bg-muted rounded px-1 py-0.5">details</code>: A JSON object for any extra data.</li>
                                    </ul>
                                </div>
                                <div>
                                    <h4 className="font-semibold mb-2">Response Codes</h4>
                                     <ul className="list-disc list-inside text-card-foreground/80 mt-1 space-y-1">
                                        <li><span className="font-mono text-green-500">200</span>: Success</li>
                                        <li><span className="font-mono text-yellow-500">400</span>: Bad Request (e.g., missing fields)</li>
                                        <li><span className="font-mono text-red-500">500</span>: Server Error</li>
                                    </ul>
                                </div>
                            </div>
                         </div>
                         {/* Test API */}
                          <div className="p-6 bg-card rounded-xl border border-border">
                             <h3 className="text-lg font-semibold mb-2">Test API</h3>
                             <p className="text-sm text-muted-foreground mb-4">Use the dashboard to send test alerts to any topic.</p>
                             <button onClick={() => onNavigate('dashboard')} className="w-full text-white bg-black hover:bg-gray-800 dark:text-black dark:bg-white dark:hover:bg-gray-200 focus:outline-none focus:ring-4 focus:ring-black/50 font-medium rounded-lg text-sm px-5 py-2.5">
                                 Go to Dashboard
                             </button>
                          </div>
                    </div>
               </div>
           </div>
        </main>
    </>
  );
};
