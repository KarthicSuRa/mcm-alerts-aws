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
      console.log('🔔 OneSignal already initialized, skipping...');
      return;
    }

    if (this.initializing) {
      console.log('🔔 OneSignal initialization in progress, waiting...');
      // Wait for the current initialization to complete
      let attempts = 0;
      while (this.initializing && attempts < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
      return;
    }

    if (!this.appId) {
      throw new Error('OneSignal App ID is not configured. Please set VITE_ONESIGNAL_APP_ID environment variable.');
    }

    if (!this.isPushSupported()) {
      console.warn('🔔 Push notifications are not supported in this browser environment');
      return;
    }

    this.initializing = true;

    try {
      // Wait for OneSignal SDK to load
      await this.waitForOneSignal();

      // Check if OneSignal is already initialized
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

      // Initialize OneSignal with updated configuration
      console.log('🔔 Initializing OneSignal with app ID:', this.appId);
      
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
      this.retryCount = 0; // Reset retry count on success
      console.log('✅ OneSignal initialized successfully');
      
    } catch (error) {
      console.error('❌ Failed to initialize OneSignal:', error);
      
      // Handle common initialization errors
      if (error instanceof Error) {
        if (error.message.includes('initialized') || error.message.includes('init')) {
          console.log('🔔 OneSignal may already be initialized, marking as initialized');
          this.initialized = true;
          return;
        }
      }
      
      // Retry initialization if failed
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        this.initializing = false;
        console.log(`🔄 Retrying OneSignal initialization (attempt ${this.retryCount}/${this.maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 1000 * this.retryCount));
        return this.initialize();
      }
      
      throw error;
    } finally {
      this.initializing = false;
    }
  }

  private waitForOneSignal(): Promise<void> {
    return new Promise((resolve, reject) => {
      const maxAttempts = 200; // Increased timeout for slower connections
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

  // Enhanced permission request with better error handling
  async requestNotificationPermission(): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.isPushSupported()) {
      console.warn('🔔 Push notifications not supported');
      return false;
    }

    try {
      // First check current permission using native API as fallback
      if ('Notification' in window) {
        const currentPermission = Notification.permission;
        console.log('🔔 Current notification permission:', currentPermission);
        
        if (currentPermission === 'denied') {
          console.log('🔔 Notification permission is denied by user');
          return false;
        }
        if (currentPermission === 'granted') {
          console.log('🔔 Notification permission already granted');
          return true;
        }
      }

      // Try OneSignal's permission request
      let permission = false;
      try {
        if (window.OneSignal?.Notifications?.requestPermission) {
          console.log('🔔 Requesting permission via OneSignal API');
          permission = await window.OneSignal.Notifications.requestPermission();
        } else {
          // Fallback to native permission request
          console.log('🔔 Falling back to native permission request');
          const result = await Notification.requestPermission();
          permission = result === 'granted';
        }
      } catch (error) {
        console.error('🔔 OneSignal permission request failed, trying native API:', error);
        // Fallback to native permission request
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

  // Enhanced subscription status check with multiple fallbacks
  async isSubscribed(): Promise<boolean> {
    if (!this.initialized) {
      try {
        await this.initialize();
      } catch (error) {
        console.error('Failed to initialize OneSignal for subscription check:', error);
        return false;
      }
    }

    if (!this.isPushSupported()) {
      return false;
    }

    try {
      // Method 1: Try new OneSignal API - optedIn status
      if (window.OneSignal?.User?.PushSubscription) {
        try {
          const optedIn = await window.OneSignal.User.PushSubscription.optedIn;
          console.log('🔔 Subscription status (optedIn):', optedIn);
          if (typeof optedIn === 'boolean') {
            return optedIn;
          }
        } catch (error) {
          console.warn('⚠️ Failed to check optedIn status:', error);
        }

        // Method 2: Try to get subscription ID
        try {
          const id = await window.OneSignal.User.PushSubscription.id;
          const hasId = Boolean(id);
          console.log('🔔 Subscription status (ID exists):', hasId, id ? `(${id.slice(0, 8)}...)` : '');
          return hasId;
        } catch (error) {
          console.warn('⚠️ Failed to check subscription ID:', error);
        }
      }

      // Method 3: Try legacy OneSignal API
      if (window.OneSignal?.isPushNotificationsEnabled) {
        try {
          const enabled = await window.OneSignal.isPushNotificationsEnabled();
          console.log('🔔 Subscription status (legacy isPushNotificationsEnabled):', enabled);
          return Boolean(enabled);
        } catch (error) {
          console.warn('⚠️ Failed to check legacy subscription status:', error);
        }
      }

      // Method 4: Try to get user ID (legacy)
      if (window.OneSignal?.getUserId) {
        try {
          const userId = await window.OneSignal.getUserId();
          const hasUserId = Boolean(userId);
          console.log('🔔 Subscription status (legacy getUserId):', hasUserId);
          return hasUserId;
        } catch (error) {
          console.warn('⚠️ Failed to get legacy user ID:', error);
        }
      }

      console.log('🔔 No subscription check method available, assuming false');
      return false;
    } catch (error) {
      console.error('❌ Failed to check subscription status:', error);
      return false;
    }
  }

  // Enhanced player ID retrieval with multiple methods
  async getPlayerId(): Promise<string | null> {
    if (!this.initialized) {
      try {
        await this.initialize();
      } catch (error) {
        console.error('Failed to initialize OneSignal for player ID retrieval:', error);
        return null;
      }
    }

    if (!this.isPushSupported()) {
      return null;
    }

    try {
      // Method 1: Try new API - subscription ID
      if (window.OneSignal?.User?.PushSubscription) {
        try {
          const id = await window.OneSignal.User.PushSubscription.id;
          if (id) {
            console.log('🔔 Player ID from new API (subscription ID):', id.slice(0, 8) + '...');
            return id;
          }
        } catch (error) {
          console.warn('⚠️ Failed to get player ID from User.PushSubscription API:', error);
        }

        // Method 2: Try to get external ID or other ID fields
        try {
          if (window.OneSignal.User.externalId) {
            const externalId = await window.OneSignal.User.externalId;
            if (externalId) {
              console.log('🔔 External ID from new API:', externalId.slice(0, 8) + '...');
              return externalId;
            }
          }
        } catch (error) {
          console.warn('⚠️ Failed to get external ID:', error);
        }
      }

      // Method 3: Try legacy getUserId API
      if (window.OneSignal?.getUserId) {
        try {
          const id = await window.OneSignal.getUserId();
          if (id) {
            console.log('🔔 Player ID from legacy API (getUserId):', id.slice(0, 8) + '...');
            return id;
          }
        } catch (error) {
          console.warn('⚠️ Failed to get player ID from legacy getUserId API:', error);
        }
      }

      // Method 4: Try getRegistrationId (another legacy method)
      if (window.OneSignal?.getRegistrationId) {
        try {
          const id = await window.OneSignal.getRegistrationId();
          if (id) {
            console.log('🔔 Player ID from legacy API (getRegistrationId):', id.slice(0, 8) + '...');
            return id;
          }
        } catch (error) {
          console.warn('⚠️ Failed to get registration ID:', error);
        }
      }

      console.log('🔔 No player ID available from any method');
      return null;
    } catch (error) {
      console.error('❌ Failed to get player ID:', error);
      return null;
    }
  }

  // Enhanced subscription method with better error handling and retry logic
  async subscribe(): Promise<string | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.isPushSupported()) {
      throw new Error('Push notifications are not supported in this browser');
    }

    try {
      console.log('🔔 Starting subscription process...');
      
      // Check if already subscribed
      const alreadySubscribed = await this.isSubscribed();
      if (alreadySubscribed) {
        console.log('🔔 User is already subscribed, getting existing player ID...');
        const existingPlayerId = await this.getPlayerId();
        if (existingPlayerId) {
          console.log('✅ Using existing subscription with player ID:', existingPlayerId.slice(0, 8) + '...');
          return existingPlayerId;
        }
      }
      
      // Request permission first
      const hasPermission = await this.requestNotificationPermission();
      if (!hasPermission) {
        throw new Error('Notification permission denied');
      }

      console.log('🔔 Permission granted, proceeding with subscription...');

      // Try to subscribe using new API
      if (window.OneSignal?.User?.PushSubscription?.optIn) {
        try {
          console.log('🔔 Using new OneSignal API for subscription');
          await window.OneSignal.User.PushSubscription.optIn();
        } catch (error) {
          console.warn('⚠️ Failed to opt in with new API:', error);
          
          // Try legacy API as fallback
          if (window.OneSignal?.registerForPushNotifications) {
            console.log('🔔 Falling back to legacy registerForPushNotifications API');
            await window.OneSignal.registerForPushNotifications();
          } else {
            throw new Error(`New API failed and legacy API not available: ${error}`);
          }
        }
      } else if (window.OneSignal?.registerForPushNotifications) {
        console.log('🔔 Using legacy API for subscription');
        await window.OneSignal.registerForPushNotifications();
      } else {
        throw new Error('OneSignal subscription API not available');
      }
      
      // Wait for subscription to be processed with enhanced retry logic
      console.log('🔔 Waiting for subscription to be processed...');
      let playerId = null;
      let attempts = 0;
      const maxAttempts = 20; // Increased attempts
      
      while (!playerId && attempts < maxAttempts) {
        const delay = 1000 + (attempts * 300); // Progressive delay
        await new Promise(resolve => setTimeout(resolve, delay));
        
        playerId = await this.getPlayerId();
        attempts++;
        console.log(`🔔 Attempt ${attempts}/${maxAttempts}: Player ID = ${playerId ? (playerId.slice(0, 8) + '...') : 'null'}`);
        
        // Additional check to see if we're actually subscribed
        if (!playerId) {
          const isSubscribed = await this.isSubscribed();
          console.log(`🔔 Subscription status check: ${isSubscribed}`);
          if (isSubscribed) {
            // Sometimes the ID takes longer to propagate, try once more with longer delay
            console.log('🔔 Subscription detected but no ID yet, waiting longer...');
            await new Promise(resolve => setTimeout(resolve, 3000));
            playerId = await this.getPlayerId();
          }
        }
      }
      
      if (!playerId) {
        // Final attempt with debug info
        const debugInfo = await this.getDebugInfo();
        console.error('🔔 Failed to get player ID after subscription. Debug info:', debugInfo);
        throw new Error('Failed to get player ID after subscription. The subscription may have failed or OneSignal is experiencing issues.');
      }
      
      console.log('✅ Successfully subscribed with player ID:', playerId.slice(0, 8) + '...');
      return playerId;
    } catch (error) {
      console.error('❌ Failed to subscribe to notifications:', error);
      throw error;
    }
  }

  // Enhanced unsubscribe method
  async unsubscribe(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      console.log('🔔 Starting unsubscription process...');
      
      // Try new API first
      if (window.OneSignal?.User?.
