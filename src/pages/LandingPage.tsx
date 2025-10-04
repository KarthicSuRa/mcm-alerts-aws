import React from 'react';
import { Icon } from '../components/ui/Icon';

interface LandingPageProps {
    onNavigate: (page: 'login' | 'signup') => void;
}

const Feature: React.FC<{ icon: string; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
    <div className="text-center p-6">
        <div className="flex items-center justify-center h-16 w-16 rounded-full bg-blue-100 mx-auto mb-5">
            <Icon name={icon} className="w-8 h-8 text-blue-600" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
        <p className="text-gray-600 leading-relaxed">{children}</p>
    </div>
);


export const LandingPage: React.FC<LandingPageProps> = ({ onNavigate }) => {

    return (
        <div className="bg-white text-gray-800 font-sans leading-normal relative overflow-hidden">
            <div className="absolute top-0 -left-40 w-96 h-96 bg-blue-100/50 rounded-full filter blur-3xl opacity-50 animate-pulse"></div>
            <div className="absolute top-1/2 -right-40 w-96 h-96 bg-indigo-100/50 rounded-full filter blur-3xl opacity-50 animate-pulse animation-delay-2000"></div>

            <div className="relative z-10">
                {/* Header */}
                <header className="bg-white/80 backdrop-blur-sm fixed top-0 left-0 right-0">
                    <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex items-center justify-between h-24">
                            <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                                    <Icon name="mcmLogo" className="w-7 h-7 text-white" />
                                </div>
                                <span className="text-2xl font-bold text-gray-900">MCM Alerts</span>
                            </div>
                            <nav className="hidden lg:flex items-center space-x-8">
                                <a href="#features" className="text-gray-600 hover:text-blue-600 transition-colors duration-300 font-medium">Features</a>
                            </nav>
                            <div className="flex items-center space-x-3">
                                <button onClick={() => onNavigate('login')} className="text-blue-600 hover:text-blue-700 transition-colors font-semibold px-5 py-2.5 rounded-lg text-sm border border-gray-300 hover:border-blue-600">
                                    Log In
                                </button>
                                <button onClick={() => onNavigate('signup')} className="bg-blue-600 text-white font-bold px-5 py-2.5 rounded-lg text-sm hover:bg-blue-700 transition-colors">
                                    Get Started
                                </button>
                            </div>
                        </div>
                    </div>
                </header>

                <main className="pt-24">
                    {/* Hero Section */}
                    <section className="px-4 pt-20 pb-28 text-center bg-gray-50/80 backdrop-blur-sm">
                        <div className="container mx-auto">
                            <h1 className="text-5xl md:text-7xl font-extrabold text-gray-900 tracking-tight mb-5 leading-tight">
                                Monitor, Alert, Resolve. <br/> The All-in-One Platform.
                            </h1>
                            <p className="max-w-3xl mx-auto text-lg text-gray-600 mb-10">
                                MCM Alerts provides a robust, centralized system for instant event notification and incident management, designed for teams that demand reliability and speed.
                            </p>
                            
                            <button 
                                onClick={() => onNavigate('signup')}
                                className="bg-blue-600 text-white font-bold px-8 py-4 rounded-lg text-lg hover:bg-blue-700 transition-colors"
                            >
                                Get Started
                            </button>
                        </div>
                    </section>

                    {/* Features Section */}
                    <section id="features" className="px-4 py-24 bg-white/80 backdrop-blur-sm">
                        <div className="container mx-auto">
                            <div className="text-center mb-16 max-w-3xl mx-auto">
                                <h2 className="text-4xl md:text-5xl font-bold text-gray-900">Why Choose MCM Alerts?</h2>
                                <p className="max-w-2xl mx-auto text-gray-600 mt-5">Powerful features designed for clarity, speed, and immediate action when it matters most.</p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
                               <Feature icon="grid" title="Centralized Dashboard">
                                    Get a bird's-eye view of all system alerts in one place. Filter, sort, and manage notifications efficiently with real-time updates.
                                </Feature>
                                <Feature icon="bell" title="Multi-Channel Alerts">
                                    Receive critical alerts via push notifications, email, SMS, and sound alerts, ensuring you never miss an important event.
                                </Feature>
                                <Feature icon="messageSquare" title="Flexible API">
                                    Integrate with any monitoring system, from custom scripts to enterprise tools, using our simple yet powerful REST API.
                                </Feature>
                                <Feature icon="comment" title="Team Collaboration">
                                    Comment on alerts, assign responsibilities, track resolution progress, and maintain clear communication channels.
                                </Feature>
                                <Feature icon="barChart" title="Comprehensive Audit Logs">
                                    Maintain a complete and searchable history of all alerts, actions, and responses for compliance and performance review.
                                </Feature>
                                <Feature icon="check-circle" title="Advanced Controls">
                                    Customize your notification experience with granular settings, smart filtering, snoozing capabilities, and priority levels.
                                </Feature>
                            </div>
                        </div>
                    </section>

                </main>

                {/* Footer */}
                <footer className="bg-gray-50/80 backdrop-blur-sm">
                    <div className="container mx-auto px-8 py-12">
                         <div className="text-center text-sm text-gray-500">
                            <p>&copy; {new Date().getFullYear()} MCM Alerts. All rights reserved.</p>
                        </div>
                    </div>
                </footer>
            </div>
        </div>
    );
};
