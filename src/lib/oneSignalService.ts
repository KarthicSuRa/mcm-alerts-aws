// OneSignal Service File
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

  public async login(externalUserId: string): Promise<void> {
    if (!this.initialized) {
      console.warn('OneSignal not initialized, cannot log in.');
      await this.initialize(); // Try to initialize first
    }
    if (!this.initialized) {
      console.error('OneSignal could not be initialized. Aborting login.');
      return;
    }
    
    try {
      console.log(`Setting OneSignal external user ID: ${externalUserId}`);
      // FIXED: Use Promise wrapper for callback-based API
      await new Promise<void>((resolve, reject) => {
        window.OneSignal.setExternalUserId(externalUserId, (result: any) => {
          if (result && result.externalUserId === externalUserId) {
            console.log('✅ OneSignal external user ID set.');
            resolve();
          } else {
            const error = new Error('Failed to set external user ID');
            console.error('❌ Failed to set OneSignal external user ID:', error);
            reject(error);
          }
        });
      });
    } catch (error) {
      console.error('❌ Failed to set OneSignal external user ID:', error);
      // We'll re-throw to let the caller know something went wrong.
      throw error;
    }
  }

  public async logout(): Promise<void> {
    if (!this.initialized) {
      console.warn('OneSignal not initialized, cannot log out.');
      return;
    }

    try {
      console.log('Removing OneSignal external user ID.');
      // FIXED: Use Promise wrapper for callback-based API
      await new Promise<void>((resolve, reject) => {
        window.OneSignal.removeExternalUserId((result: any) => {
          if (result && result.success !== false) {
            console.log('✅ OneSignal external user ID removed.');
            resolve();
          } else {
            const error = new Error('Failed to remove external user ID');
            console.error('❌ Failed to remove OneSignal external user ID:', error);
            reject(error);
          }
        });
      });
    } catch (error) {
      console.error('❌ Failed to remove OneSignal external user ID:', error);
      throw error;
    }
  }

  private async doInitialize(): Promise<void> {
    if (this.initializing) return;
    
    this.initializing = true;

    try {
      await this.waitForOneSignal();

      // Check if already initialized
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
      
      // Don't throw error to prevent blocking the app
      console.error('❌ OneSignal initialization failed after all retries');
    } finally {
      this.initializing = false;
    }
  }

  async setupForegroundNotifications(callback: (notification: any) => void): Promise<void> {
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
          
          // Generate a consistent ID based on OneSignal notification ID or content
          const oneSignalId = event.notification?.notificationId;
          const notificationId = oneSignalId || `fg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          
          const notificationData = {
            id: notificationId,
            oneSignalId: oneSignalId, // Keep track of original OneSignal ID
            title: event.notification?.title || 'Notification',
            body: event.notification?.body || '',
            message: event.notification?.body || '',
            data: event.notification?.additionalData || {},
            priority: event.notification?.priority || 5
          };
          
          callback(notificationData);
        });
        
        // UPDATED: Add background click handling (fires when SW opens app from background push)
        window.OneSignal.Notifications.addEventListener('click', (event: any) => {
          console.log('🔔 Notification clicked (new API) - handles both foreground and background:', event);
          
          const oneSignalId = event.notification?.notificationId;
          const notificationId = oneSignalId || `click-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          
          const notificationData = {
            id: notificationId,
            oneSignalId: oneSignalId,
            title: event.notification?.title || 'Notification',
            body: event.notification?.body || '',
            message: event.notification?.body || '',
            data: event.notification?.additionalData || {},
            priority: event.notification?.priority || 5
          };
          
          callback(notificationData);
        });
      } 
      else if (window.OneSignal?.on) {
        console.log('🔔 Setting up foreground notification listener (legacy API)');
        
        window.OneSignal.on('notificationDisplay', (event: any) => {
          console.log('🔔 Foreground notification received (legacy API):', event);
          
          // Generate a consistent ID
          const notificationId = event.id || `legacy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          
          const notificationData = {
            id: notificationId,
            oneSignalId: event.id,
            title: event.heading || event.title || 'Notification',
            body: event.content || event.message || '',
            message: event.content || event.message || '',
            data: event.data || {},
            priority: event.priority || 5
          };
          
          callback(notificationData);
        });
        
        // UPDATED: Add legacy background/foreground click
        window.OneSignal.on('notificationClick', (event: any) => {
          console.log('🔔 Notification clicked (legacy API):', event);
          
          const notificationId = event.id || `legacy-click-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          
          const notificationData = {
            id: notificationId,
            oneSignalId: event.id,
            title: event.heading || event.title || 'Notification',
            body: event.content || event.message || '',
            message: event.content || event.message || '',
            data: event.data || {},
            priority: event.priority || 5
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
      console.warn('⚠️ OneSignal not initialized, cannot check subscription.');
      return false;
    }
  
    if (!this.isPushSupported()) {
      console.warn('⚠️ Push not supported, cannot be subscribed.');
      return false;
    }
  
    try {
      // Modern v16+ SDK: This is the most reliable check.
      if (window.OneSignal?.User?.PushSubscription) {
        const optedIn = await window.OneSignal.User.PushSubscription.optedIn;
        console.log('🔔 Subscription status (optedIn):', optedIn);
        return Boolean(optedIn);
      }
  
      // Fallback for Legacy v15 SDK
      if (window.OneSignal?.isPushNotificationsEnabled) {
        const enabled = await new Promise<boolean>(resolve => {
          window.OneSignal.isPushNotificationsEnabled((isEnabled: boolean) => {
            resolve(isEnabled);
          });
        });
        console.log('🔔 Subscription status (legacy):', enabled);
        return enabled;
      }
  
      console.warn('⚠️ No subscription check method available, assuming false.');
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
          const id = await new Promise<string | null>((resolve) => {
            window.OneSignal.getUserId((userId: string | null) => resolve(userId));
          });
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
            console.log('🔔 Falling back to legacy API');
            await new Promise<void>((resolve, reject) => {
              window.OneSignal.registerForPushNotifications((success: boolean) => {
                if (success) resolve();
                else reject(new Error('Legacy registration failed'));
              });
            });
          } else {
            throw error;
          }
        }
      } else if (window.OneSignal?.registerForPushNotifications) {
        console.log('🔔 Using legacy API for subscription');
        await new Promise<void>((resolve, reject) => {
          window.OneSignal.registerForPushNotifications((success: boolean) => {
            if (success) resolve();
            else reject(new Error('Legacy registration failed'));
          });
        });
      } else {
        throw new Error('OneSignal subscription API not available');
      }
      
      console.log('🔔 Waiting for subscription to be processed...');
      let playerId = null;
      let attempts = 0;
      const maxAttempts = 15;
      
      while (!playerId && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000 + (attempts * 200)));
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
        await new Promise<void>((resolve, reject) => {
          window.OneSignal.setSubscription(false, (success: boolean) => {
            if (success) resolve();
            else reject(new Error('Unsubscription failed'));
          });
        });
      } else {
        throw new Error('OneSignal unsubscribe API not available');
      }
      
      console.log('✅ Successfully unsubscribed from notifications');
    } catch (error) {
      console.error('❌ Failed to unsubscribe from notifications:', error);
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
        console.warn(`⚠️ Tag value too long (max 255 chars) for key ${key}`);
        continue;
      }
      
      validatedTags[cleanKey] = stringValue;
    }
    
    return validatedTags;
  }

  async setUserTags(tags: Record<string, string>): Promise<void> {
    if (!this.initialized) {
      return;
    }

    const validatedTags = this.validateTags(tags);
    if (Object.keys(validatedTags).length === 0) {
      console.warn('⚠️ No valid tags to set');
      return;
    }

    console.log('🏷️ Attempting to set tags:', validatedTags);

    try {
      const isSubscribed = await this.isSubscribed();
      if (!isSubscribed) {
        console.warn('⚠️ User is not subscribed to push notifications, skipping tag setting');
        return;
      }

      const playerId = await this.getPlayerId();
      if (!playerId) {
        console.warn('⚠️ No player ID available, skipping tag setting');
        return;
      }

      console.log('🏷️ Setting tags for player ID:', playerId);

      if (window.OneSignal?.User?.addTags) {
        try {
          console.log('🏷️ Using new OneSignal API for tags');
          const result = await window.OneSignal.User.addTags(validatedTags);
          console.log('✅ New API result:', result);
          
          if (result && typeof result === 'object' && 'success' in result && !result.success) {
            throw new Error(`New API failed: ${JSON.stringify(result)}`);
          }
        } catch (newApiError) {
          console.warn('⚠️ New API failed, trying legacy:', newApiError);
          
          if (window.OneSignal?.sendTags) {
            console.log('🏷️ Using legacy OneSignal API for tags');
            const legacyResult = await new Promise((resolve, reject) => {
              const timeout = setTimeout(() => {
                reject(new Error('Legacy API timeout'));
              }, 10000);
              
              window.OneSignal.sendTags(validatedTags, (result: any) => {
                clearTimeout(timeout);
                console.log('✅ Legacy API callback result:', result);
                if (result && result.success === false) {
                  reject(new Error(`Legacy API failed: ${JSON.stringify(result)}`));
                } else {
                  resolve(result);
                }
              });
            });
            console.log('✅ Legacy API result:', legacyResult);
          } else {
            throw new Error('Neither new nor legacy OneSignal tags API is available');
          }
        }
      } else if (window.OneSignal?.sendTags) {
        console.log('🏷️ Using legacy OneSignal API for tags (direct)');
        const legacyResult = await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Legacy API timeout'));
          }, 10000);
          
          window.OneSignal.sendTags(validatedTags, (result: any) => {
            clearTimeout(timeout);
            console.log('✅ Legacy API callback result:', result);
            if (result && result.success === false) {
              reject(new Error(`Legacy API failed: ${JSON.stringify(result)}`));
            } else {
              resolve(result);
            }
          });
        });
        console.log('✅ Legacy API result:', legacyResult);
      } else {
        throw new Error('OneSignal tags API not available');
      }
      
      console.log('✅ User tags set successfully:', validatedTags);
    } catch (error) {
      console.error('❌ Failed to set user tags:', error);
      console.warn('⚠️ Tag setting failed but continuing with subscription process');
    }
  }

  async removeUserTags(tagKeys: string[]): Promise<void> {
    if (!this.initialized) {
      return;
    }

    try {
      console.log('🏷️ Removing tags:', tagKeys);
      
      const isSubscribed = await this.isSubscribed();
      if (!isSubscribed) {
        console.warn('⚠️ User is not subscribed, skipping tag removal');
        return;
      }

      // FIXED: Use Promise wrapper for callback-based deleteTags
      if (window.OneSignal?.User?.removeTags) {
        await window.OneSignal.User.removeTags(tagKeys);
      } else if (window.OneSignal?.deleteTags) {
        await new Promise<void>((resolve, reject) => {
          window.OneSignal.deleteTags(tagKeys, (success: boolean) => {
            if (success) {
              resolve();
            } else {
              reject(new Error('Failed to delete tags'));
            }
          });
        });
      } else {
        throw new Error('OneSignal remove tags API not available');
      }
      
      console.log('✅ User tags removed successfully:', tagKeys);
    } catch (error) {
      console.error('❌ Failed to remove user tags:', error);
    }
  }

  async savePlayerIdToDatabase(userId: string): Promise<void> {
    const playerId = await this.getPlayerId();
    if (!playerId) {
      throw new Error('No player ID available');
    }

    try {
      console.log('💾 Saving player ID to database:', { userId, playerId });
      
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

      console.log('✅ Player ID saved to database successfully');
    } catch (error) {
      console.error('❌ Failed to save player ID to database:', error);
      throw error;
    }
  }

  async removePlayerIdFromDatabase(userId: string): Promise<void> {
    try {
      console.log('🗑️ Removing player ID from database for user:', userId);
      
      const { error } = await supabase
        .from('onesignal_players')
        .delete()
        .eq('user_id', userId);

      if (error) {
        throw error;
      }

      console.log('✅ Player ID removed from database successfully');
    } catch (error) {
      console.error('❌ Failed to remove player ID from database:', error);
      throw error;
    }
  }

  onSubscriptionChange(callback: (subscribed: boolean) => void): void {
    if (!this.initialized) {
      console.warn('🔔 OneSignal not initialized yet, skipping subscription listener setup');
      return;
    }

    this.setupSubscriptionChangeListener(callback);
  }

  private setupSubscriptionChangeListener(callback: (subscribed: boolean) => void): void {
    try {
      if (window.OneSignal?.User?.PushSubscription?.addEventListener) {
        console.log('🔔 Setting up subscription change listener (new API)');
        window.OneSignal.User.PushSubscription.addEventListener('change', (event: any) => {
          const isSubscribed = event?.current?.optedIn || false;
          console.log('🔔 Subscription change event (new API):', isSubscribed);
          callback(isSubscribed);
        });
      } else if (window.OneSignal?.on) {
        console.log('🔔 Setting up subscription change listener (legacy API)');
        window.OneSignal.on('subscriptionChange', (isSubscribed: boolean) => {
          console.log('🔔 Subscription change event (legacy API):', isSubscribed);
          callback(isSubscribed);
        });
      } else {
        console.warn('⚠️ OneSignal subscription change listener API not available');
      }
    } catch (error) {
      console.error('❌ Failed to set up subscription change listener:', error);
    }
  }

  onNotificationClick(callback: (event: any) => void): void {
    if (!this.initialized) {
      console.warn('🔔 OneSignal not initialized yet, skipping notification click listener setup');
      return;
    }

    this.setupNotificationClickListener(callback);
  }

  private setupNotificationClickListener(callback: (event: any) => void): void {
    try {
      if (window.OneSignal?.Notifications?.addEventListener) {
        console.log('🔔 Setting up notification click listener (new API)');
        window.OneSignal.Notifications.addEventListener('click', callback);
      } else if (window.OneSignal?.on) {
        console.log('🔔 Setting up notification click listener (legacy API)');
        window.OneSignal.on('notificationClick', callback);
      } else {
        console.warn('⚠️ OneSignal notification click listener API not available');
      }
    } catch (error) {
      console.error('❌ Failed to set up notification click listener:', error);
    }
  }

  isLoaded(): boolean {
    return !!(window.OneSignal && typeof window.OneSignal.init === 'function');
  }

  async getDebugInfo(): Promise<any> {
    try {
      const info: any = {
        initialized: this.initialized,
        isLoaded: this.isLoaded(),
        pushSupported: this.isPushSupported(),
        appId: this.appId,
        retryCount: this.retryCount,
      };

      if (this.initialized) {
        try {
          info.isSubscribed = await this.isSubscribed();
          info.playerId = await this.getPlayerId();
        } catch (error) {
          info.subscriptionError = error instanceof Error ? error.message : String(error);
        }
      }
  
      try {
        if ('Notification' in window) {
          info.notificationPermission = Notification.permission;
        }
        if (window.OneSignal?.User?.PushSubscription) {
          info.optedIn = await window.OneSignal.User.PushSubscription.optedIn;
          info.subscriptionId = await window.OneSignal.User.PushSubscription.id;
          info.subscriptionToken = await window.OneSignal.User.PushSubscription.token;
        }
        
        info.oneSignalLoaded = !!window.OneSignal;
        info.oneSignalMethods = window.OneSignal ? Object.keys(window.OneSignal) : [];
        
      } catch (error) {
        info.additionalInfoError = error instanceof Error ? error.message : String(error);
      }
  
      return info;
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }

  // Reset method for development/testing
  reset(): void {
    this.initialized = false;
    this.initializing = false;
    this.retryCount = 0;
    this.initPromise = null;
    console.log('🔄 OneSignal service reset');
  }
}