import React from 'react';
import { Header } from '../components/layout/Header';
import { Icon } from '../components/ui/Icon';
import { Notification, SystemStatusData, Session } from '../types';

interface HowItWorksPageProps {
  notifications: Notification[];
  onNavigate: (page: string) => void;
  onLogout: () => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  openSettings: () => void;
  systemStatus: SystemStatusData;
  session: Session;
}

const steps = [
    {
        step: "01",
        icon: "zap",
        title: "Integrate Your Service",
        description: "Use our simple REST API to send alerts from your application or monitoring tool. Just a single POST request is all it takes."
    },
    {
        step: "02",
        icon: "bell",
        title: "Receive Instant Alerts",
        description: "Subscribed users get real-time push notifications with sound on their devices, ensuring critical events are never missed."
    },
    {
        step: "03",
        icon: "dashboard",
        title: "Manage on the Dashboard",
        description: "View, acknowledge, and resolve alerts from the central dashboard. Collaborate with your team by adding comments to the activity feed."
    }
];

export const HowItWorksPage: React.FC<HowItWorksPageProps> = ({ notifications, onNavigate, onLogout, isSidebarOpen, setIsSidebarOpen, openSettings, systemStatus, session }) => {
  return (
    <>
      <Header onNavigate={onNavigate} onLogout={onLogout} notifications={notifications} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} openSettings={openSettings} systemStatus={systemStatus} session={session} />
      <main className="flex-1 overflow-y-auto bg-background lg:ml-72">
        <div className="max-w-screen-2xl mx-auto p-4 sm:p-6 lg:p-8">
            <div className="max-w-4xl mx-auto">
                <div className="text-center mb-12">
                    <h1 className="text-5xl font-bold tracking-tight text-foreground sm:text-5xl">
                        A Simple, Powerful Workflow
                    </h1>
                    <p className="mt-4 text-lg leading-8 text-muted-foreground">
                        Get up and running with MCM Alerts in just three simple steps.
                    </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {steps.map((item) => (
                        <div key={item.step} className="bg-card p-8 rounded-2xl border border-border shadow-sm transition-all hover:shadow-lg hover:-translate-y-1">
                            <div className="flex items-center justify-between mb-4">
                                 <div className="p-3 bg-primary/10 rounded-lg">
                                    <Icon name={item.icon} className="w-6 h-6 text-primary" />
                                </div>
                                <span className="text-6xl font-bold text-border">{item.step}</span>
                            </div>
                            <h3 className="text-xl font-semibold text-foreground">{item.title}</h3>
                            <p className="mt-2 text-base text-muted-foreground">{item.description}</p>
                        </div>
                    ))}
                </div>

                <div className="mt-20 text-center">
                     <button onClick={() => onNavigate('api-docs')} className="inline-flex h-12 items-center justify-center rounded-lg bg-black px-8 text-sm font-bold text-white shadow-lg shadow-black/20 dark:shadow-white/10 transition-all hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200">
                        View API Docs
                    </button>
                </div>
            </div>
        </div>
      </main>
    </>
  );
};
