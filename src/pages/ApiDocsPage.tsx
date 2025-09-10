import React, { useState } from 'react';
import { Header } from '../components/layout/Header';
import { Icon } from '../components/ui/Icon';
import { Notification, SystemStatusData, Session } from '../types';

interface ApiDocsPageProps {
  onNavigate: (page: string) => void;
  onLogout: () => void;
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
  const [activeTab, setActiveTab] = useState('siteDown');
  const endpointUrl = 'https://ledvmlsdazrzntvzbeww.supabase.co/functions/v1/hyper-worker';

  const requestExamples: { [key: string]: string } = {
    siteDown: JSON.stringify({
        type: 'site_down',
        title: 'Site Down Alert',
        message: 'example.com is not responding',
        site: 'example.com',
        priority: 'high',
        timestamp: new Date().toISOString()
    }, null, 2),
    serverAlert: JSON.stringify({
        type: 'server_alert',
        title: 'CPU Usage High',
        message: 'CPU on prod-db-01 is at 95%',
        priority: 'medium',
        timestamp: new Date().toISOString()
    }, null, 2),
    custom: JSON.stringify({
        type: 'custom',
        title: 'Custom Alert',
        message: 'A custom event has occurred.',
        priority: 'low',
        details: {
            info: 'extra details here'
        },
        timestamp: new Date().toISOString()
    }, null, 2),
  };

  return (
    <>
        <Header onNavigate={onNavigate} onLogout={onLogout} notifications={notifications} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} openSettings={openSettings} systemStatus={systemStatus} session={session} />
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

                        {/* Request Examples */}
                        <div className="p-6 bg-card rounded-xl border border-border">
                            <h2 className="text-xl font-semibold mb-3">Request Examples</h2>
                            <div className="border-b border-border">
                                 <nav className="-mb-px flex space-x-4" aria-label="Tabs">
                                    {Object.keys(requestExamples).map((tab) => (
                                        <button
                                            key={tab}
                                            onClick={() => setActiveTab(tab)}
                                            className={`${
                                                activeTab === tab
                                                ? 'border-primary text-primary'
                                                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                                            } whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm capitalize`}
                                        >
                                            {tab.replace(/([A-Z])/g, ' $1')}
                                        </button>
                                    ))}
                                </nav>
                            </div>
                             <div className="mt-4">
                                <h3 className="text-sm font-semibold mb-2">JSON Payload</h3>
                                <CodeBlock code={requestExamples[activeTab]} />
                             </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        {/* Quick Reference */}
                         <div className="p-6 bg-card rounded-xl border border-border">
                            <h3 className="text-lg font-semibold mb-4">Quick Reference</h3>
                            <div className="space-y-4 text-sm">
                                <div>
                                    <h4 className="font-semibold mb-2">Priority Levels</h4>
                                    <div className="flex gap-2 mt-1">
                                        <span className="px-2 py-0.5 text-xs rounded-full bg-gray-500/10 text-gray-500">low</span>
                                        <span className="px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary">medium</span>
                                        <span className="px-2 py-0.5 text-xs rounded-full bg-red-500/10 text-red-500">high</span>
                                    </div>
                                </div>
                                <div>
                                    <h4 className="font-semibold mb-2">Required Fields</h4>
                                    <ul className="list-disc list-inside text-card-foreground/80 mt-1 space-y-1">
                                        <li><code className="text-xs bg-muted rounded px-1 py-0.5">type</code></li>
                                        <li><code className="text-xs bg-muted rounded px-1 py-0.5">title</code></li>
                                        <li><code className="text-xs bg-muted rounded px-1 py-0.5">message</code></li>
                                    </ul>
                                </div>
                                <div>
                                    <h4 className="font-semibold mb-2">Response Codes</h4>
                                     <ul className="list-disc list-inside text-card-foreground/80 mt-1 space-y-1">
                                        <li><span className="font-mono text-green-500">200</span>: Success</li>
                                        <li><span className="font-mono text-yellow-500">400</span>: Bad Request</li>
                                        <li><span className="font-mono text-red-500">500</span>: Server Error</li>
                                    </ul>
                                </div>
                            </div>
                         </div>
                         {/* Test API */}
                          <div className="p-6 bg-card rounded-xl border border-border">
                             <h3 className="text-lg font-semibold mb-2">Test API</h3>
                             <p className="text-sm text-muted-foreground mb-4">Use the dashboard to test notifications with different priority levels.</p>
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
