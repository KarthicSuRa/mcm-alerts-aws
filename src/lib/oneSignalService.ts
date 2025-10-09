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
    // If the initialization promise already exists, just return it.
    // This handles all concurrent calls from React's Strict Mode,
    // ensuring they all wait for the same single process.
    if (this.initPromise) {
      return this.initPromise;
    }

    // Create the initialization promise. This will only happen once.
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
      // Mark as initialized to prevent future attempts this session.
      this.initialized = true; 
      return;
    }

    // Self-contained retry loop.
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        await this.waitForOneSignal();

        console.log(`🔔 Initializing OneSignal with app ID: ${this.appId} (Attempt ${attempt})`);

        // The OneSignal SDK's init function is idempotent, meaning it's safe
        // to call multiple times, but we add our own layer of protection.
        await window.OneSignal.init({
          appId: this.appId,
          allowLocalhostAsSecureOrigin: true,
          serviceWorkerParam: { scope: '/' },
          serviceWorkerPath: '/sw.js',
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
        return; // <-- Success! Exit the loop and resolve the promise.

      } catch (error) {
        console.error(`❌ Failed to initialize OneSignal on attempt ${attempt}:`, error);

        if (attempt < this.maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 2000)); // Wait before retrying
        } else {
          console.error('❌ OneSignal initialization failed after all retries. Push notifications will be disabled.');
          // Do not re-throw, to avoid crashing the application.
          // The initPromise will resolve, but `this.initialized` will remain false.
        }
      }
    }
  }

  private async waitForOneSignal(): Promise<void> {
    return new Promise((resolve) => {
      if ('OneSignal' in window) {
        resolve();
      } else {
        const checkInterval = setInterval(() => {
          if ('OneSignal' in window) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
        setTimeout(() => {
          clearInterval(checkInterval);
          resolve();
        }, 5000);
      }
    });
  }

  public async login(externalUserId: string): Promise<void> {
    if (!this.initialized) {
      // Wait for initialization to complete before trying to log in.
      await this.initialize();
      // If it's still not initialized after trying, we can't proceed.
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
      // No need to do anything if the service wasn't even running.
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

  public async subscribe(): Promise<string | null> {
    if (!this.initialized) {
      await this.initialize();
    }
    try {
      await window.OneSignal.Slidedown.promptPush();
      const playerId = await window.OneSignal.getUserId();
      console.log('🔔 Successfully subscribed, player ID:', playerId);
      return playerId;
    } catch (error) {
      console.error('❌ Failed to subscribe to push notifications:', error);
      throw error;
    }
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
      console.warn('🔔 OneSignal not initialized, cannot setup foreground notifications');
      return;
    }
    try {
      // CORRECTED API: The event is 'foregroundWillDisplay'
      window.OneSignal.Notifications.addEventListener('foregroundWillDisplay', (event: any) => {
        console.log('🔔 Foreground notification received:', event);
        // It's best practice to call preventDefault to stop OneSignal's default rendering
        event.preventDefault();
        // Pass the notification data to the handler provided by App.tsx
        handler(event.notification);
      });
      console.log('✅ Foreground notification handler set up');
    } catch (error) {
      console.error('❌ Failed to set up foreground notification handler:', error);
    }
  }

  public onSubscriptionChange(handler: (isSubscribed: boolean) => void): void {
    if (!this.initialized) {
      console.warn('🔔 OneSignal not initialized, cannot set up subscription change handler');
      return;
    }
    try {
      // CORRECTED API: The event listener is on 'User.PushSubscription', not 'Notifications'
      window.OneSignal.User.PushSubscription.addEventListener('change', (change: any) => {
        console.log('🔔 Push subscription state changed:', change);
        // The new state is in `change.current.optedIn`
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
    }
    try {
      const playerId = await window.OneSignal.getUserId();
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
    }
    try {
      const userId = await window.OneSignal.getUserId();
      const isSubscribed = await window.OneSignal.User.PushSubscription.optedIn;
      const tags = await window.OneSignal.User.getTags();
      return {
        userId,
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