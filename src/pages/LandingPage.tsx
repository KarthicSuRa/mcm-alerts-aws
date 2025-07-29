import React, { useState, useEffect } from 'react';
import { Icon } from '../components/ui/Icon';

interface LandingPageProps {
  onNavigate: (page: 'login') => void;
}

const features = [
  {
    icon: 'monitor',
    title: 'Centralized Dashboard',
    description: 'Get a bird\'s-eye view of all system alerts in one place. Filter, sort, and manage notifications efficiently with real-time updates.',
  },
  {
    icon: 'bell',
    title: 'Multi-Channel Alerts',
    description: 'Receive critical alerts via push notifications, email, SMS, and sound alerts, ensuring you never miss an important event.',
  },
  {
    icon: 'zap',
    title: 'Flexible API',
    description: 'Integrate with any monitoring system, from custom scripts to enterprise tools, using our simple yet powerful REST API.',
  },
  {
    icon: 'messageSquare',
    title: 'Team Collaboration',
    description: 'Comment on alerts, assign responsibilities, track resolution progress, and maintain clear communication channels.',
  },
  {
    icon: 'logs',
    title: 'Comprehensive Audit Logs',
    description: 'Maintain a complete and searchable history of all alerts, actions, and responses for compliance and performance review.',
  },
  {
    icon: 'settings',
    title: 'Advanced Controls',
    description: 'Customize your notification experience with granular settings, smart filtering, snoozing capabilities, and priority levels.',
  },
];

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigate }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [activeFeature, setActiveFeature] = useState(0);

  useEffect(() => {
    setIsVisible(true);
    const interval = setInterval(() => {
      setActiveFeature(prev => (prev + 1) % features.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 min-h-screen">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 px-4 lg:px-6 h-16 flex items-center justify-between bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/50 dark:border-slate-700/50 shadow-sm">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-700 rounded-lg flex items-center justify-center">
            <Icon name="mcmLogo" className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-700 bg-clip-text text-transparent">MCM Alerts</span>
        </div>
        <nav className="flex gap-2 sm:gap-4 items-center">
          <button 
            onClick={() => onNavigate('login')} 
            className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            Sign In
          </button>
          <button 
            onClick={() => onNavigate('login')} 
            className="inline-flex h-10 items-center justify-center rounded-lg bg-gradient-to-r from-blue-600 to-purple-700 px-6 text-sm font-semibold text-white shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200"
          >
            Get Started
            <span className="ml-2">→</span>
          </button>
        </nav>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative pt-20 pb-16 md:pt-32 md:pb-24 overflow-hidden">
          {/* Background Elements */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 via-white to-purple-50/50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900"></div>
          <div className="absolute top-0 right-0 -translate-y-12 translate-x-12 w-96 h-96 bg-gradient-to-br from-blue-400/20 to-purple-600/20 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 translate-y-12 -translate-x-12 w-96 h-96 bg-gradient-to-tr from-purple-400/20 to-pink-600/20 rounded-full blur-3xl"></div>
          
          <div className="relative container mx-auto px-4 md:px-6">
            <div className={`flex flex-col items-center space-y-8 text-center transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
              <div className="space-y-4">
                <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
                  <span className="block">Monitor, Alert, Resolve.</span>
                  <span className="block bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                    The All-in-One Platform.
                  </span>
                </h1>
                <p className="max-w-2xl mx-auto text-lg md:text-xl text-slate-600 dark:text-slate-300 leading-relaxed">
                  MCM Alerts provides a robust, centralized system for instant event notification and incident management, designed for teams that demand reliability and speed.
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <button 
                  onClick={() => onNavigate('login')} 
                  className="inline-flex h-12 items-center justify-center rounded-lg bg-gradient-to-r from-blue-600 to-purple-700 px-8 text-base font-semibold text-white shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200"
                >
                  Get Started
                  <span className="ml-2">→</span>
                </button>
        
              </div>

              {/* Trust Indicators */}
              <div className="pt-12">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-6">
                  Trusted by 10,000+ teams worldwide
                </p>
                <div className="flex justify-center items-center gap-8 flex-wrap opacity-60">
                  {['monitor', 'shield', 'dashboard', 'zap', 'bell'].map((iconName, i) => (
                    <div key={i} className="w-12 h-12 bg-slate-200 dark:bg-slate-700 rounded-lg flex items-center justify-center">
                      <Icon name={iconName} className="w-6 h-6 text-slate-500 dark:text-slate-400" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-16 md:py-24 bg-white dark:bg-slate-800/50">
          <div className="container mx-auto px-4 md:px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Why Choose MCM Alerts?
              </h2>
              <p className="max-w-2xl mx-auto text-lg text-slate-600 dark:text-slate-300">
                Powerful features designed for clarity, speed, and immediate action when it matters most.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {features.map((feature, index) => (
                <div 
                  key={feature.title} 
                  className={`group p-6 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:shadow-xl hover:-translate-y-2 transition-all duration-300 ${activeFeature === index ? 'ring-2 ring-blue-500 shadow-lg' : ''}`}
                  onMouseEnter={() => setActiveFeature(index)}
                >
                  <div className="flex items-center space-x-4 mb-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                      <Icon name={feature.icon} className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold">{feature.title}</h3>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it Works */}
        <section className="py-16 md:py-24 bg-slate-50 dark:bg-slate-900">
          <div className="container mx-auto px-4 md:px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Get Started in Minutes
              </h2>
              <p className="text-lg text-slate-600 dark:text-slate-300">
                Simple setup process that gets you monitoring in no time
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
              {/* Connection lines */}
              <div className="hidden md:block absolute top-16 left-1/3 right-1/3 h-0.5 bg-gradient-to-r from-blue-500 to-purple-600"></div>
              
              {[
                { title: 'Connect', desc: 'Integrate our REST API into your existing monitoring systems in minutes', icon: 'zap' },
                { title: 'Configure', desc: 'Set up topics, notification rules, and team permissions with our intuitive interface', icon: 'settings' },
                { title: 'Monitor', desc: 'Receive, manage, and resolve alerts efficiently with your team', icon: 'monitor' }
              ].map((step, i) => (
                <div key={step.title} className="relative text-center group">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-2xl mx-auto mb-6 group-hover:scale-110 transition-transform duration-200 shadow-lg">
                    {i + 1}
                  </div>
                  <h3 className="text-xl font-semibold mb-3">{step.title}</h3>
                  <p className="text-slate-600 dark:text-slate-300">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16 md:py-24 bg-gradient-to-r from-blue-600 to-purple-700">
          <div className="container mx-auto px-4 md:px-6 text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Ready to Transform our Monitoring?
            </h2>
            <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
              Let MCM Alerts be the solution for our critical monitoring needs
            </p>
            <button 
              onClick={() => onNavigate('login')}
              className="inline-flex h-12 items-center justify-center rounded-lg bg-white text-blue-600 px-8 text-base font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200"
            >
              Get Started
              <span className="ml-2">→</span>
            </button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <div className="container mx-auto px-4 md:px-6 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 bg-gradient-to-br from-blue-600 to-purple-700 rounded flex items-center justify-center">
                <Icon name="mcmLogo" className="w-8 h-8 text-white" />
              </div>
              <span className="text-sm text-slate-600 dark:text-slate-400">
                © 2025 MCM Alerts. All rights reserved.
              </span>
            </div>
            <button 
              onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})} 
              className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
            >
              Back to top ↑
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
