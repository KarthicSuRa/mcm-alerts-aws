import React, { useContext } from 'react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '../lib/supabaseClient';
import { Icon } from '../components/ui/Icon';
import { ThemeContext } from '../contexts/ThemeContext';

export const SupabaseLoginPage: React.FC = () => {
    const themeContext = useContext(ThemeContext);
    const currentTheme = themeContext?.theme === 'dark' ? 'dark' : 'default';

    return (
        <div className="relative flex flex-col items-center justify-center min-h-screen p-4 bg-white overflow-hidden">
            <div className="absolute top-0 -left-40 w-96 h-96 bg-blue-100/50 rounded-full filter blur-3xl opacity-50 animate-pulse"></div>
            <div className="absolute top-1/2 -right-40 w-96 h-96 bg-indigo-100/50 rounded-full filter blur-3xl opacity-50 animate-pulse animation-delay-2000"></div>

            <div className="relative z-10 w-full max-w-sm mx-auto">
                <div className="text-center mb-10">
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
                            <Icon name="mcmLogo" className="w-10 h-10 text-white" />
                        </div>
                        <h1 className="text-4xl font-bold text-gray-900">MCM Alerts</h1>
                    </div>
                </div>
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-6 sm:p-8 border border-gray-200/50">
                    <Auth
                        supabaseClient={supabase}
                        appearance={{ theme: ThemeSupa }}
                        theme={currentTheme}
                        providers={[]}
                    />
                </div>
            </div>
        </div>
    );
};
