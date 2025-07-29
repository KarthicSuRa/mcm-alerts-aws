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
        <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background">
            <div className="w-full max-w-sm mx-auto">
                <div className="text-center mb-8">
                    <Icon name="mcmLogo" />
                </div>
                <div className="bg-card/50 backdrop-blur-lg rounded-2xl shadow-2xl p-4 sm:p-6 border border-border/50">
                    <Auth
                        supabaseClient={supabase}
                        appearance={{ theme: ThemeSupa }}
                        providers={['google', 'github']}
                        theme={currentTheme}
                    />
                </div>
            </div>
        </div>
    );
};
