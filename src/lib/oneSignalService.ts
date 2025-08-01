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

  private constructor() {
    this.appId = import.meta.env.VITE_ONESIGNAL_APP_ID;
  }

  public static getInstance(): OneSignalService {
    if (!OneSignalService.instance) {
      OneSignalService.instance = new OneSignalService();
    }
    return OneSignalService.instance;
  }

  async initialize(): Promise<void> {
    // Prevent multiple initializations
    if (this.initialized) {
      console.log('OneSignal already initialized, skipping...');
      return;
    }

    if (this.initializing) {
      console.log('OneSignal initialization in progress, waiting...');
      // Wait for the current initialization to complete
      while (this.initializing) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return;
    }

    if (!this.appId) {
      throw new Error('OneSignal App ID is not configured. Please set VITE_ONESIGNAL_APP_ID environment variable.');
    }

    this.initializing = true;

    try {
      // Wait for OneSignal SDK to load
      await this.waitForOneSignal();

      // Check if OneSignal is already initialized
      try {
        const existingState = await window.OneSignal.User.PushSubscription.optedIn;
        console.log('OneSignal appears to be already initialized, current state:', existingState);
        this.initialized = true;
        return;
      } catch (error) {
        // OneSignal not initialized yet, proceed with initialization
        console.log('OneSignal not yet initialized, proceeding...');
      }

      // Initialize OneSignal only if not already initialized
      await window.OneSignal.init({
        appId: this.appId,
        allowLocalhostAsSecureOrigin: true,
        notifyButton: {
          enable: false, // We'll handle our own UI
        },
        welcomeNotification: {
          disable: true, // Disable default welcome notification
        },
        promptOptions: {
          slidedown: {
            prompts: [
              {
                type: "push",
                autoPrompt: false, // We'll trigger manually
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
      console.log('OneSignal initialized successfully');
    } catch (error) {
      console.error('Failed to initialize OneSignal:', error);
      
      // Check if the error is about multiple initializations
      if (error instanceof Error && error.message.includes('initialized once')) {
        console.log('OneSignal was already initialized, marking as initialized');
        this.initialized = true;
        return;
      }
      
      throw error;
    } finally {
      this.initializing = false;
    }
  }

  private waitForOneSignal(): Promise<void> {
    return new Promise((resolve, reject) => {
      const maxAttempts = 50;
      let attempts = 0;

      const checkOneSignal = () => {
        attempts++;
        if (window.OneSignal) {
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

  async requestNotificationPermission(): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const permission = await window.OneSignal.Notifications.requestPermission();
      return permission;
    } catch (error) {
      console.error('Failed to request notification permission:', error);
      return false;
    }
  }

  async isSubscribed(): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const subscription = await window.OneSignal.User.PushSubscription.optedIn;
      return subscription;
    } catch (error) {
      console.error('Failed to check subscription status:', error);
      return false;
    }
  }

  async getPlayerId(): Promise<string | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const playerId = await window.OneSignal.User.PushSubscription.id;
      return playerId;
    } catch (error) {
      console.error('Failed to get player ID:', error);
      return null;
    }
  }

  async subscribe(): Promise<string | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Request permission first
      const hasPermission = await this.requestNotificationPermission();
      if (!hasPermission) {
        throw new Error('Notification permission denied');
      }

      // Subscribe to push notifications
      await window.OneSignal.User.PushSubscription.optIn();
      
      // Wait a bit for the subscription to be processed
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Get the player ID
      const playerId = await this.getPlayerId();
      if (!playerId) {
        throw new Error('Failed to get player ID after subscription');
      }
      
      return playerId;
    } catch (error) {
      console.error('Failed to subscribe to notifications:', error);
      throw error;
    }
  }

  async unsubscribe(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      await window.OneSignal.User.PushSubscription.optOut();
      console.log('Successfully unsubscribed from notifications');
    } catch (error) {
      console.error('Failed to unsubscribe from notifications:', error);
      throw error;
    }
  }

  async setUserTags(tags: Record<string, string>): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      await window.OneSignal.User.addTags(tags);
      console.log('User tags set successfully:', tags);
    } catch (error) {
      console.error('Failed to set user tags:', error);
      throw error;
    }
  }

  async removeUserTags(tagKeys: string[]): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      await window.OneSignal.User.removeTags(tagKeys);
      console.log('User tags removed successfully:', tagKeys);
    } catch (error) {
      console.error('Failed to remove user tags:', error);
      throw error;
    }
  }

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

      if (error) {
        throw error;
      }

      console.log('Player ID saved to database:', playerId);
    } catch (error) {
      console.error('Failed to save player ID to database:', error);
      throw error;
    }
  }

  async removePlayerIdFromDatabase(userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('onesignal_players')
        .delete()
        .eq('user_id', userId);

      if (error) {
        throw error;
      }

      console.log('Player ID removed from database');
    } catch (error) {
      console.error('Failed to remove player ID from database:', error);
      throw error;
    }
  }

  // Event listeners
  onSubscriptionChange(callback: (subscribed: boolean) => void): void {
    if (!this.initialized) {
      console.warn('OneSignal not initialized yet, will set up listener after initialization');
      // Set up the listener after initialization
      this.initialize().then(() => {
        this.setupSubscriptionChangeListener(callback);
      }).catch(error => {
        console.error('Failed to initialize OneSignal for subscription listener:', error);
      });
      return;
    }

    this.setupSubscriptionChangeListener(callback);
  }

  private setupSubscriptionChangeListener(callback: (subscribed: boolean) => void): void {
    try {
      window.OneSignal.User.PushSubscription.addEventListener('change', (event: any) => {
        callback(event.current.optedIn);
      });
    } catch (error) {
      console.error('Failed to set up subscription change listener:', error);
    }
  }

  onNotificationClick(callback: (event: any) => void): void {
    if (!this.initialized) {
      console.warn('OneSignal not initialized yet, will set up listener after initialization');
      // Set up the listener after initialization
      this.initialize().then(() => {
        this.setupNotificationClickListener(callback);
      }).catch(error => {
        console.error('Failed to initialize OneSignal for notification click listener:', error);
      });
      return;
    }

    this.setupNotificationClickListener(callback);
  }

  private setupNotificationClickListener(callback: (event: any) => void): void {
    try {
      window.OneSignal.Notifications.addEventListener('click', callback);
    } catch (error) {
      console.error('Failed to set up notification click listener:', error);
    }
  }
}
