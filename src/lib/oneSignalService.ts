import { supabase } from './supabaseClient';
import type { Notification, Severity } from '../types';

declare global {
  interface Window {
    OneSignal: any;
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
  private retryCount = 0;
  private maxRetries = 3;
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

  private async doInitialize(): Promise<void> {
    if (this.initializing) return;

    this.initializing = true;

    try {
      await this.waitForOneSignal();

      try {
        if (window.OneSignal?.User?.PushSubscription) {
          const state = await window.OneSignal.User.PushSubscription.optedIn;
          console.log('🔔 OneSignal appears to be already initialized, current state:', state);
          this.initialized = true;
          return;
        }
      } catch (error) {
        console.log('🔔 OneSignal not yet initialized, proceeding...');
      }

      console.log('🔔 Initializing OneSignal with app ID:', this.appId);

      await window.OneSignal.init({
        appId: this.appId,
        allowLocalhostAsSecureOrigin: true,
        serviceWorkerParam: { scope: '/onesignal/' },
        serviceWorkerPath: 'onesignal/OneSignalSDKWorker.js',
        notifyButton: {
          enable: false,
        },
        persistNotification: true,
        autoRegister: false,
        safari_web_id: import.meta.env.VITE_SAFARI_WEB_ID,
        welcomeNotification: {
          disable: true,
        },
        promptOptions: {
          slidedown: {
            prompts: [
              {
                type: 'push',
                autoPrompt: false,
                text: {
                  actionMessage: 'Enable notifications to receive real-time alerts',
                  acceptButton: 'Allow',
                  cancelButton: 'No Thanks',
                },
              },
            ],
          },
        },
      });

      this.initialized = true;
      console.log('✅ OneSignal initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize OneSignal:', error);

      if (error instanceof Error) {
        if (error.message.includes('initialized') || error.message.includes('init')) {
          console.log('🔔 OneSignal may already be initialized, marking as initialized');
          this.initialized = true;
          return;
        }
      }

      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        this.initializing = false;
        this.initPromise = null;
        console.log(`🔄 Retrying OneSignal initialization (attempt ${this.retryCount}/${this.maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return this.initialize();
      }

      console.error('❌ OneSignal initialization failed after all retries');
    } finally {
      this.initializing = false;
      this.initPromise = null;
    }
  }

  async login(userId: string): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.initialized || !this.isPushSupported()) {
      console.warn('🔔 Cannot login to OneSignal: not initialized or push not supported');
      return;
    }

    try {
      console.log('🔔 Logging in to OneSignal with external user ID:', userId);
      if (window.OneSignal?.login) {
        await window.OneSignal.login(userId);
      } else if (window.OneSignal?.setExternalUserId) {
        await window.OneSignal.setExternalUserId(userId);
      } else {
        throw new Error('OneSignal login API not available');
      }
      console.log('✅ Successfully logged in to OneSignal');
    } catch (error) {
      console.error('❌ Failed to login to OneSignal:', error);
      throw error;
    }
  }

  async logout(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    try {
      console.log('🔔 Logging out from OneSignal');
      if (window.OneSignal?.logout) {
        await window.OneSignal.logout();
      } else if (window.OneSignal?.removeExternalUserId) {
        await window.OneSignal.removeExternalUserId();
      } else {
        throw new Error('OneSignal logout API not available');
      }
      console.log('✅ Successfully logged out from OneSignal');
    } catch (error) {
      console.error('❌ Failed to logout from OneSignal:', error);
      throw error;
    }
  }

  async setupForegroundNotifications(callback: (notification: ExtendedNotification) => void): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.initialized) {
      console.warn('⚠️ OneSignal not initialized, skipping foreground setup');
      return;
    }

    try {
      if (window.OneSignal?.Notifications) {
        console.log('🔔 Setting up foreground notification listener (new API)');

        window.OneSignal.Notifications.addEventListener('foregroundWillDisplay', (event: any) => {
          console.log('🔔 Foreground notification received (new API):', event);
          event.preventDefault();

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
          event.notification.display();
        });

        window.OneSignal.Notifications.addEventListener('click', (event: any) => {
          console.log('🔔 Notification clicked (new API):', event);

          const oneSignalId = event.notification?.notificationId;
          const notificationId = oneSignalId || `click-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

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
      } else if (window.OneSignal?.on) {
        console.log('🔔 Setting up foreground notification listener (legacy API)');

        window.OneSignal.on('notificationDisplay', (event: any) => {
          console.log('🔔 Foreground notification received (legacy API):', event);

          const notificationId = event.id || `legacy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

          const notificationData: ExtendedNotification = {
            id: notificationId,
            oneSignalId: event.id,
            title: event.heading || event.title || 'Notification',
            message: event.content || event.message || '',
            severity: this.mapOneSignalSeverity(event),
            comments: [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            type: event.data?.type || 'server_alert',
            timestamp: new Date().toISOString(),
            site: event.data?.site || null,
            topic_id: event.data?.topic_id || null,
            status: event.data?.status || 'new',
          };

          callback(notificationData);
        });

        window.OneSignal.on('notificationClick', (event: any) => {
          console.log('🔔 Notification clicked (legacy API):', event);

          const notificationId = event.id || `legacy-click-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

          const notificationData: ExtendedNotification = {
            id: notificationId,
            oneSignalId: event.id,
            title: event.heading || event.title || 'Notification',
            message: event.content || event.message || '',
            severity: this.mapOneSignalSeverity(event),
            comments: [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            type: event.data?.type || 'server_alert',
            timestamp: new Date().toISOString(),
            site: event.data?.site || null,
            topic_id: event.data?.topic_id || null,
            status: event.data?.status || 'new',
          };

          callback(notificationData);
        });
      } else {
        console.warn('⚠️ OneSignal foreground notification API not available');
      }
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
    switch (notification.priority) {
      case 10:
        return 'high';
      case 5:
        return 'medium';
      default:
        return 'medium';
    }
  }

  private waitForOneSignal(): Promise<void> {
    return new Promise((resolve, reject) => {
      const maxAttempts = 100;
      let attempts = 0;

      const checkOneSignal = () => {
        attempts++;
        if (window.OneSignal && typeof window.OneSignal.init === 'function') {
          console.log(`✅ OneSignal SDK loaded after ${attempts} attempts`);
          resolve();
        } else if (attempts < maxAttempts) {
          setTimeout(checkOneSignal, 100);
        } else {
          reject(new Error('OneSignal SDK failed to load after maximum attempts'));
        }
      };

      checkOneSignal();
    });
  }

  async requestNotificationPermission(): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.initialized || !this.isPushSupported()) {
      console.warn('🔔 Push notifications not supported or OneSignal not initialized');
      return false;
    }

    try {
      if ('Notification' in window) {
        const currentPermission = Notification.permission;
        if (currentPermission === 'denied') {
          console.log('🔔 Notification permission is denied');
          return false;
        }
        if (currentPermission === 'granted') {
          console.log('🔔 Notification permission already granted');
          return true;
        }
      }

      let permission = false;
      try {
        if (window.OneSignal?.Notifications?.requestPermission) {
          permission = await window.OneSignal.Notifications.requestPermission();
        } else {
          const result = await Notification.requestPermission();
          permission = result === 'granted';
        }
      } catch (error) {
        console.error('🔔 OneSignal permission request failed, trying native API:', error);
        const result = await Notification.requestPermission();
        permission = result === 'granted';
      }

      console.log('🔔 Permission result:', permission);
      return permission;
    } catch (error) {
      console.error('❌ Failed to request notification permission:', error);
      return false;
    }
  }

  async isSubscribed(): Promise<boolean> {
    if (!this.initialized) {
      return false;
    }

    if (!this.isPushSupported()) {
      return false;
    }

    try {
      if (window.OneSignal?.User?.PushSubscription) {
        try {
          const optedIn = await window.OneSignal.User.PushSubscription.optedIn;
          console.log('🔔 Subscription status (optedIn):', optedIn);
          return Boolean(optedIn);
        } catch (error) {
          console.warn('⚠️ Failed to check optedIn status:', error);
        }

        try {
          const id = await window.OneSignal.User.PushSubscription.id;
          const token = await window.OneSignal.User.PushSubscription.token;
          console.log('🔔 Subscription status (ID exists):', !!id, 'Token exists:', !!token);
          return Boolean(id && token);
        } catch (error) {
          console.warn('⚠️ Failed to check subscription ID:', error);
        }
      }

      if (window.OneSignal?.isPushNotificationsEnabled) {
        const enabled = await window.OneSignal.isPushNotificationsEnabled();
        console.log('🔔 Subscription status (legacy):', enabled);
        return enabled;
      }

      console.log('🔔 No subscription check method available, assuming false');
      return false;
    } catch (error) {
      console.error('❌ Failed to check subscription status:', error);
      return false;
    }
  }

  async getPlayerId(): Promise<string | null> {
    if (!this.initialized) {
      return null;
    }

    if (!this.isPushSupported()) {
      return null;
    }

    try {
      if (window.OneSignal?.User?.PushSubscription) {
        try {
          const id = await window.OneSignal.User.PushSubscription.id;
          if (id) {
            console.log('🔔 Player ID from new API:', id);
            return id;
          }
        } catch (error) {
          console.warn('⚠️ Failed to get player ID from User API:', error);
        }

        try {
          const token = await window.OneSignal.User.PushSubscription.token;
          if (token) {
            console.log('🔔 Player token from new API (using as ID):', token);
            return token;
          }
        } catch (error) {
          console.warn('⚠️ Failed to get player token from User API:', error);
        }
      }

      if (window.OneSignal?.getUserId) {
        try {
          const id = await window.OneSignal.getUserId();
          if (id) {
            console.log('🔔 Player ID from legacy API:', id);
            return id;
          }
        } catch (error) {
          console.warn('⚠️ Failed to get player ID from legacy API:', error);
        }
      }

      console.log('🔔 No player ID available');
      return null;
    } catch (error) {
      console.error('❌ Failed to get player ID:', error);
      return null;
    }
  }

  async subscribe(): Promise<string | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.initialized || !this.isPushSupported()) {
      throw new Error('Push notifications are not supported in this browser or OneSignal not initialized');
    }

    try {
      console.log('🔔 Starting subscription process...');

      const hasPermission = await this.requestNotificationPermission();
      if (!hasPermission) {
        console.error('🔔 Notification permission denied');
        throw new Error('Notification permission denied');
      }

      console.log('🔔 Permission granted, proceeding with subscription...');

      if (window.OneSignal?.User?.PushSubscription?.optIn) {
        try {
          console.log('🔔 Using new OneSignal API for subscription');
          await window.OneSignal.User.PushSubscription.optIn();
        } catch (error) {
          console.warn('⚠️ Failed to opt in with new API:', error);

          if (window.OneSignal?.registerForPushNotifications) {
            console.log('🔔 Using legacy API for subscription');
            await window.OneSignal.registerForPushNotifications();
          } else {
            throw error;
          }
        }
      } else if (window.OneSignal?.registerForPushNotifications) {
        console.log('🔔 Using legacy API for subscription');
        await window.OneSignal.registerForPushNotifications();
      } else {
        throw new Error('OneSignal subscription API not available');
      }

      console.log('🔔 Waiting for subscription to be processed...');
      let playerId = null;
      let attempts = 0;
      const maxAttempts = 15;

      while (!playerId && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000 + attempts * 200));
        playerId = await this.getPlayerId();
        attempts++;
        console.log(`🔔 Attempt ${attempts}/${maxAttempts}: Player ID = ${playerId}`);

        if (!playerId) {
          const isSubscribed = await this.isSubscribed();
          console.log(`🔔 Subscription status check: ${isSubscribed}`);
          if (isSubscribed) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            playerId = await this.getPlayerId();
          }
        }
      }

      if (!playerId) {
        const debugInfo = await this.getDebugInfo();
        console.error('🔔 Failed to get player ID after subscription. Debug info:', debugInfo);
        throw new Error('Failed to get player ID after subscription. The subscription may have failed or OneSignal is experiencing issues.');
      }

      console.log('✅ Successfully subscribed with player ID:', playerId);
      return playerId;
    } catch (error) {
      console.error('❌ Failed to subscribe to notifications:', error);
      throw error;
    }
  }

  async unsubscribe(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    try {
      console.log('🔔 Starting unsubscription process...');

      if (window.OneSignal?.User?.PushSubscription?.optOut) {
        console.log('🔔 Using new API for unsubscription');
        await window.OneSignal.User.PushSubscription.optOut();
      } else if (window.OneSignal?.setSubscription) {
        console.log('🔔 Using legacy API for unsubscription');
        await window.OneSignal.setSubscription(false);
      } else {
        throw new Error('OneSignal unsubscribe API not available');
      }

      console.log('✅ Successfully unsubscribed from notifications');
    } catch (error) {
      console.error('❌ Failed to unsubscribe from notifications:', error);
      throw error;
    }
  }

  async savePlayerIdToDatabase(userId: string): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    const playerId = await this.getPlayerId();
    if (!playerId) {
      console.warn('🔔 No player ID available to save');
      return;
    }

    try {
      console.log('🔔 Saving player ID to database for user:', userId);
      const { error } = await supabase
        .from('onesignal_players')
        .upsert({ user_id: userId, player_id: playerId }, { onConflict: 'user_id' });

      if (error) {
        console.error('❌ Failed to save player ID to database:', error);
        throw error;
      }
      console.log('✅ Player ID saved to database');
    } catch (error) {
      console.error('❌ Error saving player ID to database:', error);
      throw error;
    }
  }

  async removePlayerIdFromDatabase(userId: string): Promise<void> {
    try {
      console.log('🔔 Removing player ID from database for user:', userId);
      const { error } = await supabase
        .from('onesignal_players')
        .delete()
        .eq('user_id', userId);

      if (error) {
        console.error('❌ Failed to remove player ID from database:', error);
        throw error;
      }
      console.log('✅ Player ID removed from database');
    } catch (error) {
      console.error('❌ Error removing player ID from database:', error);
      throw error;
    }
  }

  async setUserTags(tags: Record<string, string>): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.initialized || !this.isPushSupported()) {
      console.warn('🔔 Cannot set tags: OneSignal not initialized or push not supported');
      return;
    }

    try {
      const validatedTags = this.validateTags(tags);
      console.log('🔔 Setting user tags:', validatedTags);

      if (window.OneSignal?.User?.addTags) {
        await window.OneSignal.User.addTags(validatedTags);
      } else if (window.OneSignal?.sendTags) {
        await window.OneSignal.sendTags(validatedTags);
      } else {
        throw new Error('OneSignal tags API not available');
      }
      console.log('✅ User tags set successfully');
    } catch (error) {
      console.error('❌ Failed to set user tags:', error);
      throw error;
    }
  }

  async removeUserTags(tagKeys: string[]): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.initialized || !this.isPushSupported()) {
      console.warn('🔔 Cannot remove tags: OneSignal not initialized or push not supported');
      return;
    }

    try {
      console.log('🔔 Removing user tags:', tagKeys);

      if (window.OneSignal?.User?.removeTags) {
        await window.OneSignal.User.removeTags(tagKeys);
      } else if (window.OneSignal?.deleteTags) {
        await window.OneSignal.deleteTags(tagKeys);
      } else {
        throw new Error('OneSignal tags removal API not available');
      }
      console.log('✅ User tags removed successfully');
    } catch (error) {
      console.error('❌ Failed to remove user tags:', error);
      throw error;
    }
  }

  private validateTags(tags: Record<string, string>): Record<string, string> {
    const validatedTags: Record<string, string> = {};

    for (const [key, value] of Object.entries(tags)) {
      if (!key || typeof key !== 'string') {
        console.warn(`⚠️ Invalid tag key: ${key}`);
        continue;
      }

      if (key.length > 128) {
        console.warn(`⚠️ Tag key too long (max 128 chars): ${key}`);
        continue;
      }

      const cleanKey = key.replace(/[^a-zA-Z0-9_-]/g, '_');
      if (cleanKey !== key) {
        console.warn(`⚠️ Cleaned tag key from "${key}" to "${cleanKey}"`);
      }

      if (value === null || value === undefined) {
        console.warn(`⚠️ Invalid tag value for key ${key}: ${value}`);
        continue;
      }

      const stringValue = String(value);
      if (stringValue.length > 255) {
        console.warn(`⚠️ Tag value too long (max 255 chars) for key ${cleanKey}`);
        continue;
      }

      validatedTags[cleanKey] = stringValue;
    }

    return validatedTags;
  }

  async getDebugInfo(): Promise<any> {
    const debugInfo: any = {
      isPushSupported: this.isPushSupported(),
      initialized: this.initialized,
      appId: this.appId,
      notificationPermission: 'Notification' in window ? Notification.permission : 'unavailable',
    };

    if (this.initialized) {
      try {
        if (window.OneSignal?.User?.PushSubscription) {
          debugInfo.subscriptionId = await window.OneSignal.User.PushSubscription.id;
          debugInfo.subscriptionToken = await window.OneSignal.User.PushSubscription.token;
          debugInfo.optedIn = await window.OneSignal.User.PushSubscription.optedIn;
        } else if (window.OneSignal?.getUserId) {
          debugInfo.subscriptionId = await window.OneSignal.getUserId();
          debugInfo.isSubscribed = await window.OneSignal.isPushNotificationsEnabled();
        }
      } catch (error) {
        if (error instanceof Error) {
            debugInfo.error = error.message;
        }
      }
    }

    return debugInfo;
  }

  onSubscriptionChange(callback: (subscribed: boolean) => void): void {
    if (!this.initialized) {
      console.warn('🔔 Cannot set subscription change listener: OneSignal not initialized');
      return;
    }

    try {
      if (window.OneSignal?.Notifications?.addEventListener) {
        console.log('🔔 Setting up subscription change listener (new API)');
        window.OneSignal.Notifications.addEventListener('subscriptionChange', (event: any) => {
          console.log('🔔 Subscription change event (new API):', event);
          callback(event.isSubscribed);
        });
      } else if (window.OneSignal?.on) {
        console.log('🔔 Setting up subscription change listener (legacy API)');
        window.OneSignal.on('subscriptionChange', (isSubscribed: boolean) => {
          console.log('🔔 Subscription change event (legacy API):', isSubscribed);
          callback(isSubscribed);
        });
      } else {
        console.warn('⚠️ OneSignal subscription change API not available');
      }
    } catch (error) {
      console.error('❌ Failed to set up subscription change listener:', error);
    }
  }
}