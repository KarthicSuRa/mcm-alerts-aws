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
  private maxRetries: number = 3;

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
    if (this.initialized) {
      return;
    }

    if (!this.appId || !this.isPushSupported()) {
      console.warn('🔔 OneSignal prerequisites not met (no App ID, or push not supported).');
      this.initialized = true; 
      return;
    }

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        await this.waitForOneSignal();
        console.log(`🔔 Initializing OneSignal with app ID: ${this.appId} (Attempt ${attempt})`);
        await window.OneSignal.init({
          appId: this.appId,
          allowLocalhostAsSecureOrigin: true,
          serviceWorkerParam: { scope: '/' },
          serviceWorkerPath: '/sw.js',
          notifyButton: { enable: false },
          persistNotification: true,
          autoRegister: false,
          safari_web_id: import.meta.env.VITE_SAFARI_WEB_ID,
          welcomeNotification: { disable: true },
          promptOptions: {
            slidedown: {
              prompts: [
                {
                  type: "push",
                  autoPrompt: false,
                  text: {
                    actionMessage: "Enable notifications to receive real-time alerts",
                    acceptButton: "Allow",
                    cancelButton: "No Thanks"
                  }
                }
              ]
            }
          }
        });

        this.initialized = true;
        console.log('✅ OneSignal initialized successfully');
        return;

      } catch (error) {
        console.error(`❌ Failed to initialize OneSignal on attempt ${attempt}:`, error);
        if (attempt < this.maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          console.error('❌ OneSignal initialization failed after all retries.');
        }
      }
    }
  }

  private async waitForOneSignal(): Promise<void> {
    return new Promise((resolve) => {
      if (window.OneSignal?.isSdkInitialized()) {
        resolve();
      } else {
        const checkInterval = setInterval(() => {
          if (window.OneSignal?.isSdkInitialized()) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
        setTimeout(() => {
          clearInterval(checkInterval);
          resolve(); // Resolve anyway to avoid getting stuck
        }, 5000);
      }
    });
  }

  public async login(externalUserId: string): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
      if (!this.initialized) {
        console.error('❌ OneSignal could not be initialized. Aborting login.');
        return;
      }
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
    if (!this.initialized) {
        console.warn('⚠️ OneSignal not initialized, cannot get player ID.');
        return null;
    }
    const playerId = window.OneSignal.User.PushSubscription.id;
    if (playerId) {
      console.log('🔔 Player ID found:', playerId);
      return playerId;
    }
    console.warn('⚠️ Could not retrieve player ID.');
    return null;
  }

  public async subscribe(): Promise<string | null> {
    if (!this.initialized) {
      await this.initialize();
      if (!this.initialized) {
        console.error('❌ Cannot subscribe, OneSignal not initialized.');
        return null;
      }
    }

    const isSubscribed = await this.isSubscribed();
    if (isSubscribed) {
      console.log('🔔 User is already subscribed.');
      return this.getPlayerId();
    }

    console.log('🔔 Starting subscription flow...');

    // The robust way: Listen for the subscription change event.
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

    // Trigger the prompt that asks the user for permission.
    await window.OneSignal.Slidedown.promptPush();

    // Wait for the event listener to resolve the promise.
    return subscriptionPromise;
  }


  public async unsubscribe(): Promise<void> {
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
    if (!this.initialized) {
      await this.initialize();
      if (!this.initialized) return false;
    }
    try {
      const isSubscribed = await window.OneSignal.User.PushSubscription.optedIn;
      return !!isSubscribed;
    } catch (error) {
      console.error('❌ Failed to check subscription status:', error);
      return false;
    }
  }

  public async setUserTags(tags: Record<string, string>): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
      if (!this.initialized) return;
    }
    try {
      await window.OneSignal.User.addTags(tags);
      console.log('🔔 Successfully set user tags:', tags);
    } catch (error) {
      console.error('❌ Failed to set user tags:', error);
      throw error;
    }
  }

  public async removeUserTags(tags: string[]): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
      if (!this.initialized) return;
    }
    try {
      await window.OneSignal.User.removeTags(tags);
      console.log('🔔 Successfully removed user tags:', tags);
    } catch (error) {
      console.error('❌ Failed to remove user tags:', error);
      throw error;
    }
  }

  public setupForegroundNotifications(handler: (notification: any) => void): void {
    if (!this.initialized) {
      return;
    }
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
  }

  public onSubscriptionChange(handler: (isSubscribed: boolean) => void): void {
    if (!this.initialized) {
      return;
    }
    try {
      window.OneSignal.User.PushSubscription.addEventListener('change', (change: any) => {
        console.log('🔔 Push subscription state changed:', change);
        handler(!!change.current.optedIn);
      });
      console.log('✅ Subscription change handler set up');
    } catch (error) {
      console.error('❌ Failed to set up subscription change handler:', error);
    }
  }
  public async savePlayerIdToDatabase(userId: string): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
      if (!this.initialized) return;
    }
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
    if (!this.initialized) {
      return;
    }
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
    if (!this.initialized) {
      await this.initialize();
      if (!this.initialized) return {};
    }
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
