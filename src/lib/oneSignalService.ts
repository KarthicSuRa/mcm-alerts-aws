import { supabase } from './supabaseClient';
import { Database } from '../types';

type OneSignalPlayer = Database['public']['Tables']['onesignal_players']['Row'];

declare global {
    interface Window {
        OneSignal: any;
        OneSignalDeferred: any[];
    }
}

export class OneSignalService {
    private static instance: OneSignalService;
    private appId: string;
    private initialized: boolean = false;
    private initializing: boolean = false;

    private constructor() {
        this.appId = import.meta.env.VITE_ONESIGNAL_APP_ID;
        if (!this.appId) {
            console.error("VITE_ONESIGNAL_APP_ID is not set in your environment variables.");
        }
    }

    public static getInstance(): OneSignalService {
        if (!OneSignalService.instance) {
            OneSignalService.instance = new OneSignalService();
        }
        return OneSignalService.instance;
    }

    private async waitForOneSignal(): Promise<void> {
        if (window.OneSignal) {
            return;
        }
        await new Promise<void>(resolve => {
            window.OneSignalDeferred = window.OneSignalDeferred || [];
            window.OneSignalDeferred.push(() => resolve());
        });
    }

    public async initialize(): Promise<void> {
        if (this.initialized || this.initializing) {
            return;
        }
        this.initializing = true;

        try {
            await this.waitForOneSignal();
            await window.OneSignal.init({ 
                appId: this.appId,
                allowLocalhostAsSecureOrigin: true,
                serviceWorkerPath: 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDKWorker.js',
                serviceWorkerParam: { scope: '/' }
            });

            const registration = await navigator.serviceWorker.getRegistration('/');
            if (!registration?.active) {
                console.error('❌ Service worker is not active. Registration:', registration);
                throw new Error('Service worker not active');
            }
            console.log('✅ Service worker is active:', registration.active);

            this.initialized = true;
            console.log('✅ OneSignal SDK Initialized');
        } catch (error) {
            console.error('❌ Error initializing OneSignal:', error);
            this.initializing = false;
            throw error;
        } finally {
            this.initializing = false;
        }
    }

    public async login(userId: string): Promise<void> {
        await this.initialize();
        try {
            const currentUserId = window.OneSignal.User.onesignalId;
            if (currentUserId === userId) {
                console.log(`🔔 Already logged in with user ID: ${userId}`);
                return;
            }

            if (currentUserId) {
                // Clear all tags and subscriptions
                const tags = await window.OneSignal.User.getTags();
                if (tags) {
                    await window.OneSignal.User.removeTags(Object.keys(tags));
                    console.log('🔔 Cleared all existing tags.');
                }
                if (window.OneSignal.User.pushSubscription?.optedIn) {
                    await window.OneSignal.User.pushSubscription.optOut();
                    console.log('🔔 Opted out of existing push subscription.');
                }
                await this.logout();
                console.log('🔔 Cleared existing user identity.');
            }

            // Attempt login with retries
            let attempts = 0;
            const maxAttempts = 3;
            while (attempts < maxAttempts) {
                try {
                    await window.OneSignal.login(userId);
                    console.log(`✅ Logged in to OneSignal with external user ID: ${userId}`);
                    return;
                } catch (error: any) {
                    if (error?.status === 409 || error?.message?.includes('409')) {
                        attempts++;
                        console.warn(`⚠️ Login conflict (409). Attempt ${attempts}/${maxAttempts}`);
                        if (attempts === maxAttempts) {
                            console.error('❌ Max login attempts reached.');
                            throw error;
                        }
                        await new Promise(resolve => setTimeout(resolve, 1500 * attempts));
                    } else {
                        throw error;
                    }
                }
            }
        } catch (error) {
            console.error('❌ Error logging in to OneSignal:', error);
            throw error;
        }
    }

    public async logout(): Promise<void> {
        if (!this.initialized) return;
        try {
            await window.OneSignal.logout();
            console.log('✅ Logged out from OneSignal.');
        } catch (error) {
            console.error('❌ Failed to process OneSignal logout:', error);
        }
    }

    public async subscribe(): Promise<string | null> {
        await this.initialize();
        
        // Check if browser supports push notifications
        if (!('PushManager' in window)) {
            console.error('❌ Browser does not support push notifications. Browser:', navigator.userAgent);
            return null;
        }

        console.log("🔔 Requesting browser permission for notifications...");
        const permission = await window.OneSignal.Notifications.requestPermission();
        
        if (!permission) {
            console.warn('✋ Browser permission for notifications was denied.');
            return null;
        }
        console.log('👍 Permission granted.');

        // Attempt to opt in to trigger subscription creation
        let optInAttempts = 0;
        const maxOptInAttempts = 3;
        while (optInAttempts < maxOptInAttempts) {
            try {
                await window.OneSignal.User.pushSubscription.optIn();
                console.log('🔔 Triggered push subscription opt-in.');
                break;
            } catch (error) {
                console.error(`❌ Error triggering push subscription opt-in (attempt ${optInAttempts + 1}):`, error);
                optInAttempts++;
                if (optInAttempts === maxOptInAttempts) {
                    console.error('❌ Max opt-in attempts reached.');
                    return null;
                }
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        // Wait for pushSubscription to be available
        let attempts = 0;
        const maxAttempts = 15;
        const delay = 1000;
        while (!window.OneSignal.User.pushSubscription && attempts < maxAttempts) {
            console.log(`🔔 Waiting for pushSubscription to be available... Attempt ${attempts + 1}`);
            // Check native PushManager subscription
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();
            console.log('🔔 Native PushManager subscription state:', subscription);
            await new Promise(resolve => setTimeout(resolve, delay));
            attempts++;
        }

        if (!window.OneSignal.User.pushSubscription) {
            console.error('❌ Push subscription is still undefined after waiting. Browser:', navigator.userAgent);
            return null;
        }

        const token = window.OneSignal.User.pushSubscription.id;
        if (!token) {
            console.error('❌ Could not get a push subscription token after permission grant. Subscription state:', window.OneSignal.User.pushSubscription);
            return null;
        }

        console.log(`✅ Successfully subscribed with push token: ${token}`);
        return token;
    }

    public async checkAndPromptSubscription(): Promise<void> {
        const isSubscribed = await this.isSubscribed();
        if (!isSubscribed) {
            console.log('🔔 User is not subscribed to push notifications. Prompting...');
            const token = await this.subscribe();
            if (token) {
                console.log('✅ User subscribed successfully.');
            } else {
                console.warn('❌ User did not subscribe to push notifications.');
            }
        } else {
            console.log('✅ User is already subscribed to push notifications.');
        }
    }

    public async unsubscribe(): Promise<void> {
        await this.initialize();
        if (window.OneSignal.User.pushSubscription && window.OneSignal.User.pushSubscription.optedIn) {
            await window.OneSignal.User.pushSubscription.optOut();
            console.log('✅ Opted out of push notifications.');
        }
    }

    public async isSubscribed(): Promise<boolean> {
        await this.initialize();
        if (!window.OneSignal.User.pushSubscription) {
            return false;
        }
        return window.OneSignal.User.pushSubscription.optedIn;
    }

    public async getPlayerId(): Promise<string | null> {
        await this.initialize();
        if (!window.OneSignal.User.pushSubscription) {
            return null;
        }
        return window.OneSignal.User.pushSubscription.id;
    }

    public async savePlayerIdToDatabase(userId: string): Promise<void> {
        await this.initialize();
        const playerId = await this.getPlayerId();
        if (!playerId) {
            console.error('Cannot save player ID to DB: Player ID is null.');
            return;
        }

        let attempts = 0;
        const maxAttempts = 3;
        while (attempts < maxAttempts) {
            try {
                const { error } = await supabase
                    .from('onesignal_players')
                    .upsert(
                        { user_id: userId, player_id: playerId, updated_at: new Date().toISOString() },
                        { onConflict: 'user_id' }
                    );

                if (error) {
                    throw error;
                }
                console.log('Player ID saved to database successfully.');
                return;
            } catch (error) {
                console.error(`Error saving player ID to database (attempt ${attempts + 1}):`, error);
                attempts++;
                if (attempts === maxAttempts) {
                    console.error('Max attempts reached. Could not save player ID to database.');
                    return;
                }
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }

    public async removePlayerIdFromDatabase(userId: string): Promise<void> {
        const { error } = await supabase
            .from('onesignal_players')
            .delete()
            .eq('user_id', userId);

        if (error) {
            console.error('Error removing player ID from database:', error);
        }
    }
    
    public async cleanStalePlayerIds(userId: string): Promise<void> {
        await this.initialize();
        try {
            const playerId = await this.getPlayerId();
            if (playerId) {
                // Remove stale player IDs from Supabase
                const { error } = await supabase
                    .from('onesignal_players')
                    .delete()
                    .eq('user_id', userId)
                    .neq('player_id', playerId);

                if (error) {
                    console.error('Error cleaning stale player IDs from Supabase:', error);
                } else {
                    console.log('✅ Cleaned stale player IDs from Supabase for user:', userId);
                }

                // Check OneSignal backend for stale subscriptions
                const tags = await window.OneSignal.User.getTags();
                if (tags) {
                    await window.OneSignal.User.removeTags(Object.keys(tags));
                    console.log('✅ Cleared stale tags from OneSignal for user:', userId);
                }
            }
        } catch (error) {
            console.error('❌ Error cleaning stale player IDs:', error);
        }
    }

    public onSubscriptionChange(callback: (isSubscribed: boolean) => void): void {
        const setupListener = () => {
            try {
                window.OneSignal.User.pushSubscription.addEventListener('change', (change: any) => {
                    callback(change.current.optedIn);
                });
            } catch (e) {
                setTimeout(setupListener, 500);
            }
        };
        this.waitForOneSignal().then(setupListener);
    }

    public setupForegroundNotifications(handler: (notification: any) => void): void {
        const onNotificationDisplay = (event: any) => {
            console.log('Foreground notification received:', event);
            handler(event.notification);
        };
        
        window.OneSignal.Notifications.addEventListener("foregroundWillDisplay", onNotificationDisplay);
    }
    
    public async setUserTags(tags: { [key: string]: string }): Promise<void> {
        await this.initialize();
        await window.OneSignal.User.addTags(tags);
        console.log('OneSignal tags set:', tags);
    }

    public async removeUserTags(tags: string[]): Promise<void> {
        await this.initialize();
        await window.OneSignal.User.removeTags(tags);
        console.log('OneSignal tags removed:', tags);
    }
}