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
            });
            this.initialized = true;
            console.log('✅ OneSignal SDK Initialized');
        } catch (error) {
            console.error('❌ Error initializing OneSignal:', error);
        } finally {
            this.initializing = false;
        }
    }

    public async login(userId: string): Promise<void> {
        await this.initialize();
        try {
            await window.OneSignal.login(userId);
            console.log(`✅ Logged in to OneSignal with external user ID: ${userId}`);
        } catch (error) {
            console.error('❌ Error logging in to OneSignal:', error);
            throw error; 
        }
    }

    public async logout(): Promise<void> {
        try {
            await this.initialize();
            await window.OneSignal.logout();
            console.log('✅ Logged out from OneSignal.');
        } catch (error) {
            console.error('❌ Failed to process OneSignal logout:', error);
        }
    }

    public async subscribe(): Promise<string | null> {
        await this.initialize();
        console.log("🔔 Triggering native browser prompt for push notifications...");
        
        // This forces the native prompt to appear without a soft-prompt
        await window.OneSignal.Notifications.requestPermission();
        
        const isPushEnabled = window.OneSignal.Notifications.permission;
        if (!isPushEnabled) {
            console.warn('✋ Push notification permission was not granted.');
            return null;
        }
        
        console.log('👍 Permission granted. Subscribing for a new push token...');
        const token = await window.OneSignal.getPushSubscriptionId();
        if (!token) {
            console.error('❌ Could not get a push subscription token after permission grant.');
            return null;
        }

        console.log(`✅ Successfully subscribed with push token: ${token}`);
        return token;
    }

    public async unsubscribe(): Promise<void> {
        await this.initialize();
        const isSubscribed = await this.isSubscribed();
        if (isSubscribed) {
            await window.OneSignal.setSubscription(false);
            console.log('✅ Unsubscribed from push notifications.');
        }
    }

    public async isSubscribed(): Promise<boolean> {
        await this.initialize();
        return await window.OneSignal.isPushNotificationsEnabled();
    }

    public async getPlayerId(): Promise<string | null> {
        await this.initialize();
        return await window.OneSignal.getUserId();
    }

    public async savePlayerIdToDatabase(userId: string): Promise<void> {
        await this.initialize();
        const playerId = await this.getPlayerId();
        if (!playerId) {
            console.error('Cannot save player ID to DB: Player ID is null.');
            return;
        }

        const { error } = await supabase
            .from('onesignal_players')
            .upsert({ user_id: userId, player_id: playerId, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });

        if (error) {
            console.error('Error saving player ID to database:', error);
        } else {
            console.log('Player ID saved to database successfully.');
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
    
    public onSubscriptionChange(callback: (isSubscribed: boolean) => void): void {
        window.OneSignal.on('subscriptionChange', callback);
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
        await window.OneSignal.sendTags(tags);
        console.log('OneSignal tags set:', tags);
    }

    public async removeUserTags(tags: string[]): Promise<void> {
        await this.initialize();
        await window.OneSignal.deleteTags(tags);
        console.log('OneSignal tags removed:', tags);
    }
}
