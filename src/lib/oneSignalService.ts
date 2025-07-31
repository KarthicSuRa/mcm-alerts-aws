import { supabase } from './supabaseClient';

declare global {
  interface Window {
    OneSignal: any;
  }
}

export class OneSignalService {
  private static instance: OneSignalService;
  private initialized = false;
  private initializing = false;
  private appId: string;
  private retryCount = 0;
  private maxRetries = 3;

  private constructor() {
    this.appId = import.meta.env.VITE_ONESIGNAL_APP_ID;
  }

  public static getInstance(): OneSignalService {
    if (!OneSignalService.instance) {
      OneSignalService.instance = new OneSignalService();
    }
    return OneSignalService.instance;
  }

  // Check if browser supports push notifications
  private isPushSupported(): boolean {
    return (
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window &&
      window.isSecureContext
    );
  }

  // Simplified initialization
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('OneSignal already initialized');
      return;
    }

    if (this.initializing) {
      console.log('OneSignal initialization in progress');
      while (this.initializing && this.retryCount < this.maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return;
    }

    if (!this.appId) {
      throw new Error('OneSignal App ID is not configured');
    }

    if (!this.isPushSupported()) {
      console.warn('Push notifications not supported');
      return;
    }

    this.initializing = true;

    try {
      await this.waitForOneSignal();

      // Check if already initialized
      try {
        if (window.OneSignal?.User?.PushSubscription) {
          await window.OneSignal.User.PushSubscription.optedIn;
          this.initialized = true;
          return;
        }
      } catch {
        // Not initialized yet, continue
      }

      await window.OneSignal.init({
        appId: this.appId,
        allowLocalhostAsSecureOrigin: true,
        notifyButton: { enable: false },
        autoRegister: false,
        safari_web_id: import.meta.env.VITE_SAFARI_WEB_ID,
        welcomeNotification: { disable: true },
        promptOptions: {
          slidedown: {
            prompts: [{
              type: "push",
              autoPrompt: false,
              text: {
                actionMessage: "Enable notifications to receive real-time alerts",
                acceptButton: "Allow",
                cancelButton: "No Thanks"
              }
            }]
          }
        }
      });

      this.initialized = true;
      console.log('OneSignal initialized successfully');
      
    } catch (error) {
      console.error('Failed to initialize OneSignal:', error);
      
      // Handle already initialized error
      if (error instanceof Error && error.message.includes('initialized')) {
        this.initialized = true;
        return;
      }
      
      // Retry logic
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        this.initializing = false;
        console.log(`Retrying OneSignal initialization (${this.retryCount}/${this.maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return this.initialize();
      }
      
      throw error;
    } finally {
      this.initializing = false;
    }
  }

  private waitForOneSignal(): Promise<void> {
    return new Promise((resolve, reject) => {
      const maxAttempts = 100;
      let attempts = 0;

      const checkOneSignal = () => {
        attempts++;
        if (window.OneSignal && typeof window.OneSignal.init === 'function') {
          resolve();
        } else if (attempts < maxAttempts) {
          setTimeout(checkOneSignal, 100);
        } else {
          reject(new Error('OneSignal SDK failed to load'));
        }
      };

      checkOneSignal();
    });
  }

  // Request notification permission
  async requestNotificationPermission(): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.isPushSupported()) {
      console.warn('Push notifications not supported');
      return false;
    }

    try {
      // Check current permission
      if ('Notification' in window) {
        const permission = Notification.permission;
        if (permission === 'denied') return false;
        if (permission === 'granted') return true;
      }

      // Request permission
      let granted = false;
      try {
        if (window.OneSignal?.Notifications?.requestPermission) {
          granted = await window.OneSignal.Notifications.requestPermission();
        } else {
          const result = await Notification.requestPermission();
          granted = result === 'granted';
        }
      } catch {
        const result = await Notification.requestPermission();
        granted = result === 'granted';
      }

      return granted;
    } catch (error) {
      console.error('Failed to request permission:', error);
      return false;
    }
  }

  // Check subscription status
  async isSubscribed(): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.isPushSupported()) return false;

    try {
      if (window.OneSignal?.User?.PushSubscription) {
        try {
          const optedIn = await window.OneSignal.User.PushSubscription.optedIn;
          return Boolean(optedIn);
        } catch {
          try {
            const id = await window.OneSignal.User.PushSubscription.id;
            return Boolean(id);
          } catch {
            // Fall through to legacy method
          }
        }
      }

      if (window.OneSignal?.isPushNotificationsEnabled) {
        return await window.OneSignal.isPushNotificationsEnabled();
      }

      return false;
    } catch (error) {
      console.error('Failed to check subscription:', error);
      return false;
    }
  }

  // Get player ID
  async getPlayerId(): Promise<string | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.isPushSupported()) return null;

    try {
      // Try new API
      if (window.OneSignal?.User?.PushSubscription) {
        try {
          const id = await window.OneSignal.User.PushSubscription.id;
          if (id) return id;
        } catch {
          // Continue to legacy API
        }
      }

      // Try legacy API
      if (window.OneSignal?.getUserId) {
        try {
          const id = await window.OneSignal.getUserId();
          if (id) return id;
        } catch {
          // No ID available
        }
      }

      return null;
    } catch (error) {
      console.error('Failed to get player ID:', error);
      return null;
    }
  }

  // Subscribe to push notifications
  async subscribe(): Promise<string | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.isPushSupported()) {
      throw new Error('Push notifications not supported');
    }

    try {
      const hasPermission = await this.requestNotificationPermission();
      if (!hasPermission) {
        throw new Error('Permission denied');
      }

      // Subscribe using available API
      if (window.OneSignal?.User?.PushSubscription?.optIn) {
        try {
          await window.OneSignal.User.PushSubscription.optIn();
        } catch {
          if (window.OneSignal?.registerForPushNotifications) {
            await window.OneSignal.registerForPushNotifications();
          } else {
            throw new Error('No subscription API available');
          }
        }
      } else if (window.OneSignal?.registerForPushNotifications) {
        await window.OneSignal.registerForPushNotifications();
      } else {
        throw new Error('No subscription API available');
      }
      
      // Wait for subscription to process
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Get player ID with retries
      let playerId = null;
      let attempts = 0;
      while (!playerId && attempts < 5) {
        playerId = await this.getPlayerId();
        if (!playerId) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          attempts++;
        }
      }
      
      if (!playerId) {
        throw new Error('Failed to get player ID');
      }
      
      return playerId;
    } catch (error) {
      console.error('Failed to subscribe:', error);
      throw error;
    }
  }

  // Unsubscribe from push notifications
  async unsubscribe(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      if (window.OneSignal?.User?.PushSubscription?.optOut) {
        await window.OneSignal.User.PushSubscription.optOut();
      } else if (window.OneSignal?.setSubscription) {
        await window.OneSignal.setSubscription(false);
      } else {
        throw new Error('No unsubscribe API available');
      }
      
      console.log('Successfully unsubscribed');
    } catch (error) {
      console.error('Failed to unsubscribe:', error);
      throw error;
    }
  }

  // Set user tags
  async setUserTags(tags: Record<string, string>): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      if (window.OneSignal?.User?.addTags) {
        await window.OneSignal.User.addTags(tags);
      } else if (window.OneSignal?.sendTags) {
        await window.OneSignal.sendTags(tags);
      } else {
        throw new Error('No tags API available');
      }
      
      console.log('Tags set:', tags);
    } catch (error) {
      console.error('Failed to set tags:', error);
      throw error;
    }
  }

  // Remove user tags
  async removeUserTags(tagKeys: string[]): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      if (window.OneSignal?.User?.removeTags) {
        await window.OneSignal.User.removeTags(tagKeys);
      } else if (window.OneSignal?.deleteTags) {
        await window.OneSignal.deleteTags(tagKeys);
      } else {
        throw new Error('No remove tags API available');
      }
      
      console.log('Tags removed:', tagKeys);
    } catch (error) {
      console.error('Failed to remove tags:', error);
      throw error;
    }
  }

  // Database operations
  async savePlayerIdToDatabase(userId: string): Promise<void> {
    const playerId = await this.getPlayerId();
    if (!playerId) {
      throw new Error('No player ID available');
    }

    try {
      const { error } = await supabase
        .from('onesignal_players')
        .upsert({
          user_id: userId,
          player_id: playerId,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;
      console.log('Player ID saved:', playerId);
    } catch (error) {
      console.error('Failed to save player ID:', error);
      throw error;
    }
  }

  async removePlayerIdFromDatabase(userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('onesignal_players')
        .delete()
        .eq('user_id', userId);

      if (error) throw error;
      console.log('Player ID removed from database');
    } catch (error) {
      console.error('Failed to remove player ID:', error);
      throw error;
    }
  }

  // Event listeners
  onSubscriptionChange(callback: (subscribed: boolean) => void): void {
    if (!this.initialized) {
      this.initialize().then(() => {
        this.setupSubscriptionChangeListener(callback);
      }).catch(error => {
        console.error('Failed to setup subscription listener:', error);
      });
      return;
    }

    this.setupSubscriptionChangeListener(callback);
  }

  private setupSubscriptionChangeListener(callback: (subscribed: boolean) => void): void {
    try {
      if (window.OneSignal?.User?.PushSubscription?.addEventListener) {
        window.OneSignal.User.PushSubscription.addEventListener('change', (event: any) => {
          const isSubscribed = event?.current?.optedIn || false;
          callback(isSubscribed);
        });
      } else if (window.OneSignal?.on) {
        window.OneSignal.on('subscriptionChange', callback);
      }
    } catch (error) {
      console.error('Failed to setup subscription listener:', error);
    }
  }

  onNotificationClick(callback: (event: any) => void): void {
    if (!this.initialized) {
      this.initialize().then(() => {
        this.setupNotificationClickListener(callback);
      }).catch(error => {
        console.error('Failed to setup click listener:', error);
      });
      return;
    }

    this.setupNotificationClickListener(callback);
  }

  private setupNotificationClickListener(callback: (event: any) => void): void {
    try {
      if (window.OneSignal?.Notifications?.addEventListener) {
        window.OneSignal.Notifications.addEventListener('click', callback);
      } else if (window.OneSignal?.on) {
        window.OneSignal.on('notificationClick', callback);
      }
    } catch (error) {
      console.error('Failed to setup click listener:', error);
    }
  }

  // Utility methods
  isLoaded(): boolean {
    return !!(window.OneSignal && typeof window.OneSignal.init === 'function');
  }

  async getDebugInfo(): Promise<any> {
    if (!this.initialized) {
      return { error: 'OneSignal not initialized' };
    }

    try {
      const info: any = {
        initialized: this.initialized,
        isLoaded: this.isLoaded(),
        isSubscribed: await this.isSubscribed(),
        playerId: await this.getPlayerId(),
        pushSupported: this.isPushSupported(),
      };

      try {
        if ('Notification' in window) {
          info.notificationPermission = Notification.permission;
        }
        if (window.OneSignal?.User?.PushSubscription) {
          info.optedIn = await window.OneSignal.User.PushSubscription.optedIn;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        info.additionalInfoError = errorMessage;
      }

      return info;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { error: errorMessage };
    }
  }
}
