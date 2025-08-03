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

  // Enhanced initialization with better error handling
  async initialize(): Promise<void> {
    // Prevent multiple initializations
    if (this.initialized) {
      console.log('OneSignal already initialized, skipping...');
      return;
    }

    if (this.initializing) {
      console.log('OneSignal initialization in progress, waiting...');
      // Wait for the current initialization to complete
      while (this.initializing && this.retryCount < this.maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return;
    }

    if (!this.appId) {
      throw new Error('OneSignal App ID is not configured. Please set VITE_ONESIGNAL_APP_ID environment variable.');
    }

    if (!this.isPushSupported()) {
      console.warn('Push notifications are not supported in this browser environment');
      return;
    }

    this.initializing = true;

    try {
      // Wait for OneSignal SDK to load
      await this.waitForOneSignal();

      // Check if OneSignal is already initialized by trying to access its state
      try {
        // Try to access OneSignal API to check if it's initialized
        if (window.OneSignal?.User?.PushSubscription) {
          const state = await window.OneSignal.User.PushSubscription.optedIn;
          console.log('OneSignal appears to be already initialized, current state:', state);
          this.initialized = true;
          return;
        }
      } catch (error) {
        // OneSignal not initialized yet or API structure changed, proceed with initialization
        console.log('OneSignal not yet initialized, proceeding...');
      }

      // Initialize OneSignal with updated configuration
      await window.OneSignal.init({
        appId: this.appId,
        allowLocalhostAsSecureOrigin: true,
        
        // Updated notification configuration
        notifyButton: {
          enable: false, // We handle our own UI
        },
        
        // Disable automatic prompts
        autoRegister: false,
        
        // Safari web push ID (if using Safari)
        safari_web_id: import.meta.env.VITE_SAFARI_WEB_ID,
        
        // Updated welcome notification config
        welcomeNotification: {
          disable: true,
        },
        
        // Updated prompt configuration
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
      console.log('OneSignal initialized successfully');
      
    } catch (error) {
      console.error('Failed to initialize OneSignal:', error);
      
      // Handle common initialization errors
      if (error instanceof Error) {
        if (error.message.includes('initialized') || error.message.includes('init')) {
          console.log('OneSignal may already be initialized, marking as initialized');
          this.initialized = true;
          return;
        }
      }
      
      // Retry initialization if failed
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        this.initializing = false;
        console.log(`Retrying OneSignal initialization (attempt ${this.retryCount}/${this.maxRetries})`);
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
      const maxAttempts = 100; // Increased from 50
      let attempts = 0;

      const checkOneSignal = () => {
        attempts++;
        if (window.OneSignal && typeof window.OneSignal.init === 'function') {
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

  // Enhanced permission request with better error handling
  async requestNotificationPermission(): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.isPushSupported()) {
      console.warn('Push notifications not supported');
      return false;
    }

    try {
      // First check current permission using native API as fallback
      if ('Notification' in window) {
        const currentPermission = Notification.permission;
        if (currentPermission === 'denied') {
          console.log('Notification permission is denied');
          return false;
        }
        if (currentPermission === 'granted') {
          console.log('Notification permission already granted');
          return true;
        }
      }

      // Try OneSignal's permission request
      let permission = false;
      try {
        if (window.OneSignal?.Notifications?.requestPermission) {
          permission = await window.OneSignal.Notifications.requestPermission();
        } else {
          // Fallback to native permission request
          const result = await Notification.requestPermission();
          permission = result === 'granted';
        }
      } catch (error) {
        console.error('OneSignal permission request failed, trying native API:', error);
        // Fallback to native permission request
        const result = await Notification.requestPermission();
        permission = result === 'granted';
      }

      console.log('Permission result:', permission);
      return permission;

    } catch (error) {
      console.error('Failed to request notification permission:', error);
      return false;
    }
  }

  // Enhanced subscription status check
  async isSubscribed(): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.isPushSupported()) {
      return false;
    }

    try {
      // Try multiple methods to check subscription status
      if (window.OneSignal?.User?.PushSubscription) {
        try {
          const optedIn = await window.OneSignal.User.PushSubscription.optedIn;
          return Boolean(optedIn);
        } catch (error) {
          console.warn('Failed to check optedIn status:', error);
        }

        try {
          const id = await window.OneSignal.User.PushSubscription.id;
          return Boolean(id);
        } catch (error) {
          console.warn('Failed to check subscription ID:', error);
        }
      }

      // Fallback method for older OneSignal versions
      if (window.OneSignal?.isPushNotificationsEnabled) {
        return await window.OneSignal.isPushNotificationsEnabled();
      }

      return false;
    } catch (error) {
      console.error('Failed to check subscription status:', error);
      return false;
    }
  }

  // Enhanced player ID retrieval
  async getPlayerId(): Promise<string | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.isPushSupported()) {
      return null;
    }

    try {
      // Try new API first
      if (window.OneSignal?.User?.PushSubscription) {
        try {
          const id = await window.OneSignal.User.PushSubscription.id;
          if (id) return id;
        } catch (error) {
          console.warn('Failed to get player ID from User API:', error);
        }
      }

      // Try legacy API as fallback
      if (window.OneSignal?.getUserId) {
        try {
          const id = await window.OneSignal.getUserId();
          if (id) return id;
        } catch (error) {
          console.warn('Failed to get player ID from legacy API:', error);
        }
      }

      return null;
    } catch (error) {
      console.error('Failed to get player ID:', error);
      return null;
    }
  }

  // Enhanced subscription method with better tag handling
  async subscribe(): Promise<string | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.isPushSupported()) {
      throw new Error('Push notifications are not supported in this browser');
    }

    try {
      // Request permission first
      const hasPermission = await this.requestNotificationPermission();
      if (!hasPermission) {
        throw new Error('Notification permission denied');
      }

      // Try to subscribe using new API
      if (window.OneSignal?.User?.PushSubscription?.optIn) {
        try {
          await window.OneSignal.User.PushSubscription.optIn();
        } catch (error) {
          console.warn('Failed to opt in with new API:', error);
          
          // Try legacy API as fallback
          if (window.OneSignal?.registerForPushNotifications) {
            await window.OneSignal.registerForPushNotifications();
          } else {
            throw error;
          }
        }
      } else if (window.OneSignal?.registerForPushNotifications) {
        await window.OneSignal.registerForPushNotifications();
      } else {
        throw new Error('OneSignal subscription API not available');
      }
      
      // Wait for subscription to be processed with retries
      console.log('Waiting for subscription to be processed...');
      let playerId = null;
      let attempts = 0;
      const maxAttempts = 10;
      
      while (!playerId && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        playerId = await this.getPlayerId();
        attempts++;
        console.log(`Attempt ${attempts}: Player ID = ${playerId}`);
      }
      
      if (!playerId) {
        throw new Error('Failed to get player ID after subscription');
      }
      
      console.log('Successfully subscribed with player ID:', playerId);
      return playerId;
    } catch (error) {
      console.error('Failed to subscribe to notifications:', error);
      throw error;
    }
  }

  // Enhanced unsubscribe method
  async unsubscribe(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Try new API first
      if (window.OneSignal?.User?.PushSubscription?.optOut) {
        await window.OneSignal.User.PushSubscription.optOut();
      } else if (window.OneSignal?.setSubscription) {
        // Try legacy API
        await window.OneSignal.setSubscription(false);
      } else {
        throw new Error('OneSignal unsubscribe API not available');
      }
      
      console.log('Successfully unsubscribed from notifications');
    } catch (error) {
      console.error('Failed to unsubscribe from notifications:', error);
      throw error;
    }
  }

  // Add tag validation method
  private validateTags(tags: Record<string, string>): Record<string, string> {
    const validatedTags: Record<string, string> = {};
    
    for (const [key, value] of Object.entries(tags)) {
      // Validate key
      if (!key || typeof key !== 'string') {
        console.warn(`Invalid tag key: ${key}`);
        continue;
      }
      
      if (key.length > 128) {
        console.warn(`Tag key too long (max 128 chars): ${key}`);
        continue;
      }
      
      // Remove special characters from key
      const cleanKey = key.replace(/[^a-zA-Z0-9_-]/g, '_');
      if (cleanKey !== key) {
        console.warn(`Cleaned tag key from "${key}" to "${cleanKey}"`);
      }
      
      // Validate value
      if (value === null || value === undefined) {
        console.warn(`Invalid tag value for key ${key}: ${value}`);
        continue;
      }
      
      const stringValue = String(value);
      if (stringValue.length > 255) {
        console.warn(`Tag value too long (max 255 chars) for key ${key}`);
        continue;
      }
      
      validatedTags[cleanKey] = stringValue;
    }
    
    return validatedTags;
  }

  // Enhanced tag management with better error handling and validation
  async setUserTags(tags: Record<string, string>): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Validate tags before sending
    const validatedTags = this.validateTags(tags);
    if (Object.keys(validatedTags).length === 0) {
      console.warn('No valid tags to set');
      return;
    }

    console.log('Attempting to set tags:', validatedTags);

    try {
      // Check if user is subscribed first
      const isSubscribed = await this.isSubscribed();
      if (!isSubscribed) {
        throw new Error('User is not subscribed to push notifications');
      }

      // Get player ID to ensure it exists
      const playerId = await this.getPlayerId();
      if (!playerId) {
        throw new Error('No player ID available');
      }

      console.log('Setting tags for player ID:', playerId);

      // Try new API first with better error handling
      if (window.OneSignal?.User?.addTags) {
        try {
          console.log('Using new OneSignal API for tags');
          const result = await window.OneSignal.User.addTags(validatedTags);
          console.log('New API result:', result);
          
          // Check if the result indicates success
          if (result && typeof result === 'object' && 'success' in result && !result.success) {
            throw new Error(`New API failed: ${JSON.stringify(result)}`);
          }
        } catch (newApiError) {
          console.warn('New API failed, trying legacy:', newApiError);
          
          // Fallback to legacy API
          if (window.OneSignal?.sendTags) {
            console.log('Using legacy OneSignal API for tags');
            const legacyResult = await new Promise((resolve, reject) => {
              window.OneSignal.sendTags(validatedTags, (result: any) => {
                console.log('Legacy API callback result:', result);
                if (result && result.success === false) {
                  reject(new Error(`Legacy API failed: ${JSON.stringify(result)}`));
                } else {
                  resolve(result);
                }
              });
            });
            console.log('Legacy API result:', legacyResult);
          } else {
            throw new Error('Neither new nor legacy OneSignal tags API is available');
          }
        }
      } else if (window.OneSignal?.sendTags) {
        // Direct legacy API usage
        console.log('Using legacy OneSignal API for tags (direct)');
        const legacyResult = await new Promise((resolve, reject) => {
          window.OneSignal.sendTags(validatedTags, (result: any) => {
            console.log('Legacy API callback result:', result);
            if (result && result.success === false) {
              reject(new Error(`Legacy API failed: ${JSON.stringify(result)}`));
            } else {
              resolve(result);
            }
          });
        });
        console.log('Legacy API result:', legacyResult);
      } else {
        throw new Error('OneSignal tags API not available');
      }
      
      console.log('User tags set successfully:', validatedTags);
    } catch (error) {
      console.error('Failed to set user tags:', error);
      
      // Don't throw the error, just log it to prevent blocking the subscription flow
      // throw error;
    }
  }

  async removeUserTags(tagKeys: string[]): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Try new API first
      if (window.OneSignal?.User?.removeTags) {
        await window.OneSignal.User.removeTags(tagKeys);
      } else if (window.OneSignal?.deleteTags) {
        // Try legacy API
        await window.OneSignal.deleteTags(tagKeys);
      } else {
        throw new Error('OneSignal remove tags API not available');
      }
      
      console.log('User tags removed successfully:', tagKeys);
    } catch (error) {
      console.error('Failed to remove user tags:', error);
      // Don't throw the error for tag operations
    }
  }

  // Database operations remain the same
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

  // Enhanced event listeners with better error handling
  onSubscriptionChange(callback: (subscribed: boolean) => void): void {
    if (!this.initialized) {
      console.warn('OneSignal not initialized yet, will set up listener after initialization');
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
      // Try new API first
      if (window.OneSignal?.User?.PushSubscription?.addEventListener) {
        window.OneSignal.User.PushSubscription.addEventListener('change', (event: any) => {
          const isSubscribed = event?.current?.optedIn || false;
          callback(isSubscribed);
        });
      } else if (window.OneSignal?.on) {
        // Try legacy API
        window.OneSignal.on('subscriptionChange', (isSubscribed: boolean) => {
          callback(isSubscribed);
        });
      } else {
        console.warn('OneSignal subscription change listener API not available');
      }
    } catch (error) {
      console.error('Failed to set up subscription change listener:', error);
    }
  }

  onNotificationClick(callback: (event: any) => void): void {
    if (!this.initialized) {
      console.warn('OneSignal not initialized yet, will set up listener after initialization');
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
      // Try new API first
      if (window.OneSignal?.Notifications?.addEventListener) {
        window.OneSignal.Notifications.addEventListener('click', callback);
      } else if (window.OneSignal?.on) {
        // Try legacy API
        window.OneSignal.on('notificationClick', callback);
      } else {
        console.warn('OneSignal notification click listener API not available');
      }
    } catch (error) {
      console.error('Failed to set up notification click listener:', error);
    }
  }

  // Utility method to check if OneSignal is properly loaded
  isLoaded(): boolean {
    return !!(window.OneSignal && typeof window.OneSignal.init === 'function');
  }

  // Method to get current OneSignal state for debugging
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
  
      // Try to get additional info if available
      try {
        if ('Notification' in window) {
          info.notificationPermission = Notification.permission;
        }
        if (window.OneSignal?.User?.PushSubscription) {
          info.optedIn = await window.OneSignal.User.PushSubscription.optedIn;
        }
      } catch (error) {
        // Fix: Properly type the error
        info.additionalInfoError = error instanceof Error ? error.message : String(error);
      }
  
      return info;
    } catch (error) {
      // Fix: Properly type the error
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }
}
