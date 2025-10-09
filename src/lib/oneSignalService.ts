// OneSignal Service File
import { supabase } from './supabaseClient';

declare global {
  interface Window {
    OneSignal: any;
  }
}

export class OneSignalService {
  private static instance: OneSignalService;
  private appId: string | undefined;
  private initialized: boolean = false;
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

  public isPushSupported(): boolean {
    return 'OneSignal' in window && 'serviceWorker' in navigator && 'PushManager' in window;
  }

  initialize(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }
    console.log('🔔 Creating OneSignal initialization promise...');
    this.initPromise = this.doInitialize();
    return this.initPromise;
  }

  private async doInitialize(): Promise<void> {
    return new Promise(async (resolve, reject) => {
      if (this.initialized) {
        return resolve();
      }
      if (!this.appId || !this.isPushSupported()) {
        console.warn('🔔 OneSignal prerequisites not met (no App ID, or push not supported).');
        this.initialized = true; // Mark as initialized to prevent retries
        return resolve(); // Resolve, as there's nothing more to do
      }

      try {
        await this.waitForOneSignal();

        // The definitive, robust way to initialize OneSignal.
        // We push a function to the queue that will run once the SDK is fully ready.
        window.OneSignal.push(() => {
          console.log('✅ OneSignal SDK is ready and has been initialized.');
          this.initialized = true;
          resolve(); // This resolves the main `initialize()` promise.
        });

        console.log(`🔔 Initializing OneSignal with app ID: ${this.appId}`);
        
        // We call init, but we DO NOT await it. The promise is unreliable.
        // The queued function above is our signal that initialization is complete.
        window.OneSignal.init({
          appId: this.appId,
          allowLocalhostAsSecureOrigin: true,
          serviceWorkerParam: { scope: '/' },
          serviceWorkerPath: '/sw.js',
          notifyButton: { enable: false },
          persistNotification: true,
          autoRegister: false,
          safari_web_id: import.meta.env.VITE_SAFARI_WEB_ID,
          welcomeNotification: { disable: true },
        });

      } catch (error) {
        console.error('❌ OneSignal initialization failed catastrophically.', error);
        reject(error);
      }
    });
  }

  private async waitForOneSignal(): Promise<void> {
    return new Promise((resolve, reject) => {
      const maxAttempts = 50; // 50 * 100ms = 5 seconds
      let attempts = 0;

      const check = () => {
        if (window.OneSignal && typeof window.OneSignal.push === 'function') {
          console.log('✅ OneSignal SDK script loaded and queue is available.');
          resolve();
        } else {
          attempts++;
          if (attempts < maxAttempts) {
            setTimeout(check, 100);
          } else {
            reject(new Error('OneSignal SDK failed to load in time.'));
          }
        }
      };
      check();
    });
  }

  public async login(externalUserId: string): Promise<void> {
    await this.initialize();
    if (!this.initialized) {
      console.error('❌ OneSignal not initialized. Aborting login.');
      return;
    }
    try {
      console.log(`🔔 Setting OneSignal external user ID: ${externalUserId}`);
      await window.OneSignal.User.setExternalUserId(externalUserId);
      console.log(`✅ Successfully set OneSignal external user ID`);
    } catch (error) {
      console.error('❌ Failed to set OneSignal external user ID:', error);
      throw error;
    }
  }

  public async logout(): Promise<void> {
    await this.initialize();
    if (!this.initialized) {
      return;
    }
    try {
      console.log(`🔔 Removing OneSignal external user ID.`);
      await window.OneSignal.User.removeExternalUserId();
      console.log('✅ Successfully removed OneSignal external user ID');
    } catch (error) {
      console.error('❌ Failed to remove OneSignal external user ID:', error);
      throw error;
    }
  }

  public async getPlayerId(): Promise<string | null> {
    await this.initialize();
    if (!this.initialized) {
      console.warn('⚠️ OneSignal not initialized, cannot get player ID.');
      return null;
    }
    const playerId = window.OneSignal.User.PushSubscription.id;
    if (playerId) {
      return playerId;
    }
    return null;
  }

  public async subscribe(): Promise<string | null> {
    await this.initialize();
    if (!this.initialized) {
      console.error('❌ Cannot subscribe, OneSignal not initialized.');
      return null;
    }

    const isSubscribed = await this.isSubscribed();
    if (isSubscribed) {
      console.log('🔔 User is already subscribed.');
      return this.getPlayerId();
    }

    console.log('🔔 Starting subscription flow...');

    const subscriptionPromise = new Promise<string | null>((resolve) => {
      this.onSubscriptionChange(async (isNowSubscribed) => {
        if (isNowSubscribed) {
          const playerId = await this.getPlayerId();
          console.log('✅ Subscription successful. Player ID:', playerId);
          resolve(playerId);
        } else {
          console.log('🔔 User chose not to subscribe or the process was cancelled.');
          resolve(null);
        }
      });
    });

    await window.OneSignal.Slidedown.promptPush();

    return subscriptionPromise;
  }


  public async unsubscribe(): Promise<void> {
    await this.initialize();
    if (!this.initialized) {
      return;
    }
    try {
      await window.OneSignal.User.PushSubscription.optOut();
      console.log('🔔 Successfully unsubscribed from push notifications');
    } catch (error) {
      console.error('❌ Failed to unsubscribe from push notifications:', error);
      throw error;
    }
  }

  public async isSubscribed(): Promise<boolean> {
    await this.initialize();
    if (!this.initialized) return false;
    
    try {
      return window.OneSignal.User.PushSubscription.optedIn;
    } catch (error) {
      console.error('❌ Failed to check subscription status:', error);
      return false;
    }
  }

  public async setUserTags(tags: Record<string, string>): Promise<void> {
    await this.initialize();
    if (!this.initialized) return;
    try {
      await window.OneSignal.User.addTags(tags);
      console.log('🔔 Successfully set user tags:', tags);
    } catch (error) {
      console.error('❌ Failed to set user tags:', error);
      throw error;
    }
  }

  public async removeUserTags(tags: string[]): Promise<void> {
    await this.initialize();
    if (!this.initialized) return;
    try {
      await window.OneSignal.User.removeTags(tags);
      console.log('🔔 Successfully removed user tags:', tags);
    } catch (error) {
      console.error('❌ Failed to remove user tags:', error);
      throw error;
    }
  }

  public setupForegroundNotifications(handler: (notification: any) => void): void {
    window.OneSignal.push(() => {
      console.log('🔔 Setting up foreground notification handler...');
      try {
        window.OneSignal.Notifications.addEventListener('foregroundWillDisplay', (event: any) => {
          console.log('🔔 Foreground notification received:', event);
          event.preventDefault();
          handler(event.notification);
        });
        console.log('✅ Foreground notification handler set up');
      } catch (error) {
        console.error('❌ Failed to set up foreground notification handler:', error);
      }
    });
  }

  public onSubscriptionChange(handler: (isSubscribed: boolean) => void): void {
    window.OneSignal.push(() => {
      console.log('🔔 Setting up subscription change handler...');
      try {
        window.OneSignal.User.PushSubscription.addEventListener('change', (change: any) => {
          console.log('🔔 Push subscription state changed:', change);
          handler(!!change.current.optedIn);
        });
        console.log('✅ Subscription change handler set up');
      } catch (error) {
        console.error('❌ Failed to set up subscription change handler:', error);
      }
    });
  }
  public async savePlayerIdToDatabase(userId: string): Promise<void> {
    await this.initialize();
    if (!this.initialized) return;
    try {
      const playerId = await this.getPlayerId();
      if (!playerId) {
        console.warn('🔔 No player ID available to save to database');
        return;
      }
      const { error } = await supabase
        .from('onesignal_players')
        .upsert({ user_id: userId, player_id: playerId });
      if (error) {
        console.error('❌ Failed to save player ID to database:', error);
        throw error;
      }
      console.log('✅ Player ID saved to database:', playerId);
    } catch (error) {
      console.error('❌ Error saving player ID to database:', error);
      throw error;
    }
  }

  public async removePlayerIdFromDatabase(userId: string): Promise<void> {
    await this.initialize();
    if (!this.initialized) return;
    try {
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

  public async getDebugInfo(): Promise<any> {
    await this.initialize();
    if (!this.initialized) return {};
    try {
      const playerId = await this.getPlayerId();
      const isSubscribed = await this.isSubscribed();
      const tags = await window.OneSignal.User.getTags();
      return {
        userId: playerId,
        isSubscribed,
        tags,
        initialized: this.initialized,
        appId: this.appId,
      };
    } catch (error) {
      console.error('❌ Failed to get debug info:', error);
      return {};
    }
  }
}
