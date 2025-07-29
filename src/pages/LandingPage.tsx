import React from 'react';
import { Icon } from '../components/ui/Icon';

interface LandingPageProps {
  onNavigate: (page: 'login') => void;
}

const features = [
  {
    icon: 'monitor',
    title: 'Centralized Dashboard',
    description: 'Get a bird\'s-eye view of all system alerts in one place. Filter, sort, and manage notifications efficiently.',
  },
  {
    icon: 'bell',
    title: 'Multi-Channel Alerts',
    description: 'Receive critical alerts via push notifications and sound, ensuring you never miss an important event.',
  },
  {
    icon: 'zap',
    title: 'Flexible API',
    description: 'Integrate with any monitoring system, from custom scripts to enterprise tools, using our simple REST API.',
  },
   {
    icon: 'messageSquare',
    title: 'Team Collaboration',
    description: 'Comment on alerts, track resolution progress, and maintain a clear audit trail for accountability.',
  },
  {
    icon: 'logs',
    title: 'Audit Logs',
    description: 'Maintain a complete and searchable history of all alerts and actions for compliance and review.',
  },
   {
    icon: 'settings',
    title: 'User-centric Controls',
    description: 'Customize your notification experience with granular settings, including snoozing and sound preferences.',
  },
];

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigate }) => {
  return (
    <div className="bg-background text-foreground">
      <header className="fixed top-0 left-0 right-0 z-50 px-4 lg:px-6 h-20 flex items-center justify-between bg-background/80 backdrop-blur-sm border-b border-border/50">
        <a href="#" className="flex items-center justify-center" onClick={(e) => e.preventDefault()}>
          <Icon name="mcmLogo" />
        </a>
        <nav className="flex gap-4 sm:gap-6 items-center">
          <button onClick={() => onNavigate('login')} className="text-sm font-semibold text-muted-foreground hover:text-primary">
            Sign In
          </button>
          <button onClick={() => onNavigate('login')} className="inline-flex h-10 items-center justify-center rounded-md bg-foreground px-6 text-sm font-semibold text-background shadow-lg transition-all hover:bg-foreground/90">
            Get Started
          </button>
        </nav>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="w-full pt-32 pb-20 md:pt-48 md:pb-32 relative overflow-hidden">
            <div className="absolute top-0 left-0 -translate-x-1/3 -translate-y-1/3 w-full h-[150%] bg-gradient-radial from-primary/10 via-background to-background blur-3xl -z-10"></div>
            <div className="container px-4 md:px-6">
                 <div className="flex flex-col items-center space-y-6 text-center">
                    <h1 className="text-4xl font-extrabold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl text-foreground">
                        Monitor, Alert, Resolve.
                        <br />
                        <span className="text-primary">The All-in-One Platform.</span>
                    </h1>
                    <p className="max-w-[700px] text-muted-foreground md:text-xl">
                        MCM Alerts provides a robust, centralized system for instant event notification and incident management, designed for teams that demand reliability.
                    </p>
                    <div className="space-x-4">
                        <button onClick={() => onNavigate('login')} className="inline-flex h-12 items-center justify-center rounded-lg bg-foreground px-8 text-sm font-bold text-background shadow-lg shadow-black/20 dark:shadow-white/10 transition-all hover:bg-foreground/90">
                           Get Started 
                        </button>
                    </div>
                </div>
                 <div className="mt-16 text-center">
                    <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Trusted by the world's best teams</p>
                    <div className="mt-6 flex justify-center items-center gap-8 flex-wrap">
                        <Icon name="zap" className="w-24 h-8 text-muted-foreground" />
                        <Icon name="monitor" className="w-24 h-8 text-muted-foreground" />
                        <Icon name="shield" className="w-24 h-8 text-muted-foreground" />
                        <Icon name="dashboard" className="w-24 h-8 text-muted-foreground" />
                        <Icon name="logs" className="w-24 h-8 text-muted-foreground" />
                    </div>
                </div>
            </div>
        </section>

        {/* Features Section */}
        <section id="features" className="w-full py-12 md:py-24 lg:py-32 bg-secondary/50">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center mb-12">
                <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl">Why Choose MCM Alerts?</h2>
                <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed">
                    Powerful features designed for clarity and immediate action.
                </p>
            </div>
            <div className="mx-auto grid max-w-6xl items-start gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => (
                <div key={feature.title} className="flex flex-col gap-4 p-6 rounded-lg transition-all bg-card border border-transparent hover:border-border hover:shadow-xl hover:-translate-y-1">
                  <div className="inline-block rounded-lg bg-primary/10 p-3 text-primary self-start">
                    <Icon name={feature.icon} className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xl font-bold">{feature.title}</h3>
                    <p className="text-muted-foreground">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it Works Section */}
        <section className="w-full py-12 md:py-24 lg:py-32">
             <div className="container px-4 md:px-6">
                <div className="flex flex-col items-center justify-center space-y-4 text-center mb-12">
                    <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl">Get Started in 3 Easy Steps</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
                    {/* Dashed line connector */}
                    <div className="hidden md:block absolute top-1/2 left-0 w-full h-px -translate-y-1/2">
                         <svg width="100%" height="2"><line x1="0" y1="1" x2="100%" y2="1" strokeWidth="2" strokeDasharray="8 8" className="stroke-border"/></svg>
                    </div>
                    {['Connect', 'Configure', 'Conquer'].map((title, i) => (
                        <div key={title} className="relative flex flex-col items-center text-center z-10">
                            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary text-primary-foreground font-bold text-2xl border-4 border-background">{i+1}</div>
                            <h3 className="mt-6 text-xl font-semibold">{title}</h3>
                            <p className="mt-2 text-muted-foreground">{
                                i === 0 ? "Integrate our REST API into your systems." :
                                i === 1 ? "Create topics and manage subscriptions." :
                                "Receive and resolve alerts like a pro."
                            }</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="container px-4 md:px-6 py-8">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                 <p className="text-sm text-muted-foreground">&copy; 2025 MCM Alerts. All rights reserved.</p>
                 <button onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})} className="text-sm font-medium text-primary hover:underline">Back to top &uarr;</button>
            </div>
        </div>
      </footer>
    </div>
  );
};
