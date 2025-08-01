import { supabase } from './supabaseClient';

// lib/oneSignalService.ts
export class OneSignalService {
  private static instance: OneSignalService;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;

  private constructor() {}

  public static getInstance(): OneSignalService {
    if (!OneSignalService.instance) {
      OneSignalService.instance = new OneSignalService();
    }
    return OneSignalService.instance;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initializationPromise) return this.initializationPromise;

    this.initializationPromise = this.initializeOneSignal();
    await this.initializationPromise;
    this.isInitialized = true;
  }

  private async initializeOneSignal(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!window.OneSignal) {
        console.error('OneSignal SDK not loaded');
        reject(new Error('OneSignal SDK not loaded'));
        return;
      }

      window.OneSignal.init({
        appId: 'YOUR_ONESIGNAL_APP_ID', // Replace with your actual app ID
        safari_web_id: 'YOUR_SAFARI_WEB_ID', // Optional: for Safari
        notifyButton: {
          enable: false,
        },
        allowLocalhostAsSecureOrigin: true,
        autoRegister: false, // We'll handle registration manually
        autoResubscribe: true,
        persistNotification: false,
        showCreatedNotification: false, // Prevent duplicate notifications
        welcomeNotification: {
          disable: true
        },
        notificationClickHandlerMatch: 'origin',
        serviceWorkerParam: {
          scope: '/'
        },
        serviceWorkerPath: '/OneSignalSDKWorker.js',
        serviceWorkerUpdaterPath: '/OneSignalSDKUpdaterWorker.js'
      }).then(() => {
        console.log('OneSignal initialized successfully');
        
        // Set up notification display handler for mobile browsers
        this.setupMobileNotificationHandling();
        
        resolve();
      }).catch((error) => {
        console.error('OneSignal initialization failed:', error);
        reject(error);
      });
    });
  }

  private setupMobileNotificationHandling(): void {
    // Handle foreground notifications for mobile browsers
    window.OneSignal.on('notificationDisplay', (event) => {
      console.log('OneSignal notification displayed:', event);
      
      // For mobile browsers, manually show in-app notification
      if (this.isMobileBrowser()) {
        this.showInAppNotification(event);
      }
    });

    // Handle notification clicks
    window.OneSignal.on('notificationClick', (event) => {
      console.log('OneSignal notification clicked:', event);
      
      // Trigger custom notification click handler
      if (this.onNotificationClickCallback) {
        this.onNotificationClickCallback(event);
      }
    });

    // Handle subscription changes
    window.OneSignal.on('subscriptionChange', (isSubscribed) => {
      console.log('OneSignal subscription changed:', isSubscribed);
      
      if (this.onSubscriptionChangeCallback) {
        this.onSubscriptionChangeCallback(isSubscribed);
      }
    });
  }

  private isMobileBrowser(): boolean {
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
    
    // Check for mobile user agents
    const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
    
    // Additional check for touch capability
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    return isMobile || (isTouchDevice && window.innerWidth <= 768);
  }

  private showInAppNotification(event: any): void {
    // Extract notification data
    const { title, body, data } = event.notification || {};
    
    // Create a custom notification toast
    const notificationData = {
      id: `mobile-${Date.now()}`,
      title: title || 'New Alert',
      message: body || 'You have received a new notification',
      severity: data?.severity || 'medium',
      status: 'new',
      timestamp: new Date().toISOString(),
      created_at: new Date().toISOString(),
      topic_id: data?.topic_id || null,
      comments: []
    };

    // Dispatch custom event to show toast
    window.dispatchEvent(new CustomEvent('oneSignalForegroundNotification', {
      detail: notificationData
    }));
  }

  public async subscribe(): Promise<string | null> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // Check if already subscribed
      const isSubscribed = await window.OneSignal.getRegistration();
      if (isSubscribed) {
        const playerId = await window.OneSignal.getPlayerId();
        console.log('Already subscribed with player ID:', playerId);
        return playerId;
      }

      // Request notification permission
      const permission = await this.requestNotificationPermission();
      if (permission !== 'granted') {
        throw new Error('Notification permission denied');
      }

      // Register for push notifications
      await window.OneSignal.registerForPushNotifications();
      
      // Wait for subscription to complete
      const playerId = await this.waitForSubscription();
      
      console.log('Successfully subscribed with player ID:', playerId);
      return playerId;
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      throw error;
    }
  }

  private async requestNotificationPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      throw new Error('This browser does not support notifications');
    }

    if (Notification.permission === 'granted') {
      return 'granted';
    }

    if (Notification.permission === 'denied') {
      throw new Error('Notification permission was previously denied');
    }

    // Request permission
    const permission = await Notification.requestPermission();
    return permission;
  }

  private async waitForSubscription(timeout = 10000): Promise<string> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const checkSubscription = async () => {
        try {
          const playerId = await window.OneSignal.getPlayerId();
          if (playerId) {
            resolve(playerId);
            return;
          }
        } catch (error) {
          console.warn('Error checking subscription status:', error);
        }

        // Check timeout
        if (Date.now() - startTime > timeout) {
          reject(new Error('Subscription timeout'));
          return;
        }

        // Continue checking
        setTimeout(checkSubscription, 500);
      };

      checkSubscription();
    });
  }

  public async unsubscribe(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      await window.OneSignal.setSubscription(false);
      console.log('Successfully unsubscribed from push notifications');
    } catch (error) {
      console.error('Failed to unsubscribe:', error);
      throw error;
    }
  }

  public async isSubscribed(): Promise<boolean> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const registration = await window.OneSignal.getRegistration();
      return !!registration;
    } catch (error) {
      console.error('Error checking subscription status:', error);
      return false;
    }
  }

  public async getPlayerId(): Promise<string | null> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      return await window.OneSignal.getPlayerId();
    } catch (error) {
      console.error('Error getting player ID:', error);
      return null;
    }
  }

  public async setUserTags(tags: Record<string, string>): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      await window.OneSignal.sendTags(tags);
      console.log('User tags set successfully:', tags);
    } catch (error) {
      console.error('Failed to set user tags:', error);
      throw error;
    }
  }

  public async removeUserTags(tagKeys: string[]): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      await window.OneSignal.deleteTags(tagKeys);
      console.log('User tags removed successfully:', tagKeys);
    } catch (error) {
      console.error('Failed to remove user tags:', error);
      throw error;
    }
  }

  public async savePlayerIdToDatabase(userId: string): Promise<void> {
    try {
      const playerId = await this.getPlayerId();
      if (!playerId) {
        throw new Error('No player ID available');
      }

      // Import supabase client
      const { supabase } = await import('./supabaseClient');
      
      const { error } = await supabase
        .from('onesignal_players')
        .upsert({ 
          user_id: userId, 
          player_id: playerId,
          updated_at: new Date().toISOString()
        });

      if (error) {
        throw error;
      }

      console.log('Player ID saved to database successfully');
    } catch (error) {
      console.error('Failed to save player ID to database:', error);
      throw error;
    }
  }

  public async removePlayerIdFromDatabase(userId: string): Promise<void> {
    try {
      // Import supabase client
      const { supabase } = await import('./supabaseClient');
      
      const { error } = await supabase
        .from('onesignal_players')
        .delete()
        .eq('user_id', userId);

      if (error) {
        throw error;
      }

      console.log('Player ID removed from database successfully');
    } catch (error) {
      console.error('Failed to remove player ID from database:', error);
      throw error;
    }
  }

  // Callback handlers
  private onSubscriptionChangeCallback: ((subscribed: boolean) => void) | null = null;
  private onNotificationClickCallback: ((event: any) => void) | null = null;

  public onSubscriptionChange(callback: (subscribed: boolean) => void): void {
    this.onSubscriptionChangeCallback = callback;
  }

  public onNotificationClick(callback: (event: any) => void): void {
    this.onNotificationClickCallback = callback;
  }
}

// Extend Window interface for TypeScript
declare global {
  interface Window {
    OneSignal: any;
  }
}
