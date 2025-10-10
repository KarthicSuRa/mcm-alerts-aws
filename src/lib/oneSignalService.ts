
import { supabase } from './supabaseClient';
import type { Notification, Severity } from '../types';

declare global {
  interface Window {
    OneSignal: any;
    OneSignalDeferred: any[];
  }
}

interface ExtendedNotification extends Notification {
  oneSignalId?: string;
}

export class OneSignalService {
  private static instance: OneSignalService;
  private initialized = false;
  private initializing = false;
  private appId: string;
  private initPromise: Promise<void> | null = null;

  private constructor() {
    this.appId = import.meta.env.VITE_ONESIGNAL_APP_ID;
  }

  public static getInstance(): OneSignalService {
    if (!OneSignalService.instance) {
      OneSignalService.instance = new OneSignalService();
    }
    return OneSignalService.instance;
  }

  private isPushSupported(): boolean {
    return (
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window &&
      window.isSecureContext
    );
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('🔔 OneSignal already initialized, skipping...');
      return;
    }

    if (this.initPromise) {
      console.log('🔔 OneSignal initialization in progress, waiting...');
      return this.initPromise;
    }

    if (!this.appId) {
      console.warn('OneSignal App ID is not configured. Skipping OneSignal initialization.');
      return;
    }

    if (!this.isPushSupported()) {
      console.warn('🔔 Push notifications are not supported in this browser environment');
      return;
    }

    this.initPromise = this.doInitialize();
    return this.initPromise;
  }

  private doInitialize(): Promise<void> {
    this.initializing = true;
    return new Promise((resolve, reject) => {
        console.log("OneSignal: Queuing initialization command.");

        const initializationTimeout = setTimeout(() => {
            this.initializing = false;
            reject(new Error('OneSignal initialization timed out after 40 seconds. This might be due to a slow network, ad-blocker, or an issue with the OneSignal script.'));
        }, 40000);

        window.OneSignalDeferred = window.OneSignalDeferred || [];

        window.OneSignalDeferred.push(async (OneSignal: any) => {
            console.log("OneSignal: SDK loaded, executing init().");
            try {
                const oneSignalConfig: any = {
                    appId: this.appId,
                    allowLocalhostAsSecureOrigin: true,
                    notifyButton: { enable: false },
                    persistNotification: true,
                    autoRegister: false,
                    welcomeNotification: { disable: true },
                };

                const safariWebId = import.meta.env.VITE_SAFARI_WEB_ID;
                if (safariWebId) {
                    oneSignalConfig.safari_web_id = safariWebId;
                }

                await OneSignal.init(oneSignalConfig);

                clearTimeout(initializationTimeout);
                console.log('✅ OneSignal initialized successfully.');
                this.initialized = true;
                this.initializing = false;
                this.initPromise = null;
                resolve();
            } catch (error) {
                clearTimeout(initializationTimeout);
                console.error('❌ Failed to initialize OneSignal:', error);
                this.initializing = false;
                this.initPromise = null;
                reject(error);
            }
        });
    });
  }

  async login(userId: string): Promise<void> {
    await this.initialize();

    if (!this.initialized || !this.isPushSupported()) {
      console.warn('🔔 Cannot login to OneSignal: not initialized or push not supported');
      return;
    }

    try {
      console.log('🔔 Logging in to OneSignal with external user ID:', userId);
      await window.OneSignal.login(userId);
      console.log('✅ Successfully logged in to OneSignal');
    } catch (error) {
      console.error('❌ Failed to login to OneSignal:', error);
      throw error;
    }
  }

  async logout(): Promise<void> {
    if (!this.initialized) return;

    try {
      console.log('🔔 Logging out from OneSignal');
      await window.OneSignal.logout();
      console.log('✅ Successfully logged out from OneSignal');
    } catch (error) {
      console.error('❌ Failed to logout from OneSignal:', error);
      throw error;
    }
  }

  async setupForegroundNotifications(callback: (notification: ExtendedNotification) => void): Promise<void> {
    await this.initialize();

    if (!this.initialized) {
      console.warn('⚠️ OneSignal not initialized, skipping foreground setup');
      return;
    }

    try {
        console.log('🔔 Setting up foreground notification listener');
        window.OneSignal.Notifications.addEventListener('foregroundWillDisplay', (event: any) => {
          console.log('🔔 Foreground notification received:', event);
          try {
            event.preventDefault();
          } catch (e) {
            console.warn("⚠️ Browser does not support preventing default notification display.", e);
          }

          const oneSignalId = event.notification?.notificationId;
          const notificationId = oneSignalId || `fg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

          const notificationData: ExtendedNotification = {
            id: notificationId,
            oneSignalId,
            title: event.notification?.title || 'Notification',
            message: event.notification?.body || '',
            severity: this.mapOneSignalSeverity(event.notification),
            comments: [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            type: event.notification?.additionalData?.type || 'server_alert',
            timestamp: new Date().toISOString(),
            site: event.notification?.additionalData?.site || null,
            topic_id: event.notification?.additionalData?.topic_id || null,
            status: event.notification?.additionalData?.status || 'new',
          };

          callback(notificationData);
        });
    } catch (error) {
      console.error('❌ Failed to set up foreground notification listener:', error);
    }
  }

  private mapOneSignalSeverity(notification: any): Severity {
    if (notification.data?.severity) {
      const severity = notification.data.severity.toLowerCase();
      if (['low', 'medium', 'high'].includes(severity)) {
        return severity as Severity;
      }
    }
    return 'medium';
  }

  async requestNotificationPermission(): Promise<boolean> {
    await this.initialize();

    if (!this.initialized || !this.isPushSupported()) {
      console.warn('🔔 Push notifications not supported or OneSignal not initialized');
      return false;
    }

    try {
        const permission = await window.OneSignal.Notifications.requestPermission();
        console.log('🔔 Permission result:', permission);
        return permission;
    } catch (error) {
      console.error('❌ Failed to request notification permission:', error);
      return false;
    }
  }

  async isSubscribed(): Promise<boolean> {
    await this.initialize();
    if (!this.initialized || !this.isPushSupported()) return false;

    try {
        return window.OneSignal.User.PushSubscription.optedIn;
    } catch (error) {
      console.error('❌ Failed to check subscription status:', error);
      return false;
    }
  }
  
  async getPlayerId(): Promise<string | null> {
    await this.initialize();
    if (!this.initialized || !this.isPushSupported()) return null;

    try {
        const id = window.OneSignal.User.PushSubscription.id;
        if (id) {
          console.log('🔔 Player ID:', id);
          return id;
        }
        console.log('🔔 No player ID available yet.');
        return null;
    } catch (error) {
      console.error('❌ Failed to get player ID:', error);
      return null;
    }
  }

  async subscribe(): Promise<string | null> {
    await this.initialize();
    if (!this.initialized || !this.isPushSupported()) {
      throw new Error('Push notifications are not supported or OneSignal not initialized');
    }
    
    try {
      console.log('🔔 Starting subscription process...');
      const hasPermission = await this.requestNotificationPermission();
      if (!hasPermission) {
        throw new Error('Notification permission was not granted.');
      }
  
      await window.OneSignal.User.PushSubscription.optIn();
      console.log('🔔 Subscription opt-in command sent.');
      
      let playerId = null;
      let attempts = 0;
      while (!playerId && attempts < 10) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        playerId = await this.getPlayerId();
        attempts++;
        console.log(`🔔 Attempt ${attempts}/10 to get Player ID: ${playerId}`);
      }
      
      if (!playerId) {
        throw new Error('Failed to get a player ID after opting in.');
      }

      console.log('✅ Successfully subscribed with player ID:', playerId);
      return playerId;
    } catch (error) {
      console.error('❌ Failed to subscribe:', error);
      throw error;
    }
  }
  
  async unsubscribe(): Promise<void> {
    await this.initialize();
    if (!this.initialized) return;

    try {
        await window.OneSignal.User.PushSubscription.optOut();
        console.log('✅ Successfully unsubscribed.');
    } catch (error) {
      console.error('❌ Failed to unsubscribe:', error);
      throw error;
    }
  }

  async savePlayerIdToDatabase(userId: string): Promise<void> {
    const playerId = await this.getPlayerId();
    if (!playerId) {
      console.warn('🔔 No player ID available to save.');
      return;
    }

    try {
      console.log('🔔 Saving player ID to database for user:', userId);
      const { error } = await supabase
        .from('onesignal_players')
        .upsert({ user_id: userId, player_id: playerId }, { onConflict: 'player_id' });

      if (error) throw error;
      console.log('✅ Player ID saved to database');
    } catch (error) {
      console.error('❌ Error saving player ID to database:', error);
      throw error;
    }
  }

  async removeAllPlayerIdsFromDatabase(userId: string): Promise<void> {
    try {
      console.log('🔔 Removing all player IDs from database for user:', userId);
      const { error } = await supabase
        .from('onesignal_players')
        .delete()
        .eq('user_id', userId);

      if (error) {
        console.error('❌ Failed to remove player IDs from database:', error);
        throw error;
      }
      console.log('✅ All player IDs for user removed from database');
    } catch (error) {
      console.error('❌ Error removing player IDs from database:', error);
      throw error;
    }
  }

  async removeCurrentPlayerIdFromDatabase(): Promise<void> {
    const playerId = await this.getPlayerId();
    if (!playerId) {
      console.warn('🔔 No player ID available to remove.');
      return;
    }

    try {
      console.log('🔔 Removing current player ID from database:', playerId);
      const { error } = await supabase
        .from('onesignal_players')
        .delete()
        .eq('player_id', playerId);

      if (error) {
        console.error('❌ Failed to remove current player ID from database:', error);
        throw error;
      }
      console.log('✅ Current player ID removed from database');
    } catch (error) {
      console.error('❌ Error removing current player ID from database:', error);
      throw error;
    }
  }

  async setUserTags(tags: Record<string, string>): Promise<void> {
    await this.initialize();
    if (!this.initialized) return;

    try {
        await window.OneSignal.User.addTags(tags);
        console.log('✅ User tags set successfully');
    } catch (error) {
      console.error('❌ Failed to set user tags:', error);
      throw error;
    }
  }

  async removeUserTags(tagKeys: string[]): Promise<void> {
    await this.initialize();
    if (!this.initialized) return;

    try {
        await window.OneSignal.User.removeTags(tagKeys);
        console.log('✅ User tags removed successfully');
    } catch (error) {
      console.error('❌ Failed to remove user tags:', error);
      throw error;
    }
  }

  onSubscriptionChange(callback: (isSubscribed: boolean) => void): void {
    if (!this.initialized) {
        this.initialize().then(() => {
            if(this.initialized) {
                window.OneSignal.User.PushSubscription.addEventListener('change', (change: any) => {
                    callback(change.current.optedIn);
                });
            }
        });
    } else {
        window.OneSignal.User.PushSubscription.addEventListener('change', (change: any) => {
            callback(change.current.optedIn);
        });
    }
  }
}
