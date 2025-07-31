import { supabase } from './supabaseClient';

declare global {
  interface Window {
    OneSignal: any;
  }
}

export class OneSignalService {
  private static instance: OneSignalService;
  private initialized = false;
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
    if (this.initialized || !this.appId) {
      return;
    }

    try {
      // Wait for OneSignal SDK to load
      await this.waitForOneSignal();

      // Initialize OneSignal
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
      throw error;
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
      
      // Get the player ID
      const playerId = await this.getPlayerId();
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
      console.warn('OneSignal not initialized yet');
      return;
    }

    window.OneSignal.User.PushSubscription.addEventListener('change', (event: any) => {
      callback(event.current.optedIn);
    });
  }

  onNotificationClick(callback: (event: any) => void): void {
    if (!this.initialized) {
      console.warn('OneSignal not initialized yet');
      return;
    }

    window.OneSignal.Notifications.addEventListener('click', callback);
  }
}
