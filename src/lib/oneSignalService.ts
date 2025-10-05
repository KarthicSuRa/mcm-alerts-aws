import { supabase } from './supabaseClient';

declare global {
  interface Window {
    OneSignal: any;
    OneSignalDeferred: any; // Added for deferred loading support
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
      return;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    if (!this.appId) {
      console.warn('OneSignal App ID is not configured. Skipping OneSignal initialization.');
      // FIX: Throw an error if the App ID is missing, as this is a critical configuration issue.
      throw new Error('OneSignal App ID is not configured.');
    }

    if (!this.isPushSupported()) {
      console.warn('🔔 Push notifications are not supported in this browser environment');
      // FIX: Throw an error so the UI can inform the user.
      throw new Error('Push notifications are not supported in this browser.');
    }

    this.initPromise = this.doInitialize();
    return this.initPromise;
  }

  // FIXED: Updated to use OneSignal.login() (new API, replaces setExternalUserId)
  public async login(externalUserId: string): Promise<void> {
    await this.initialize();
    
    try {
      console.log(`Setting OneSignal external user ID: ${externalUserId}`);
      // Use modern promise-based login
      await window.OneSignal.login(externalUserId);
      console.log('✅ OneSignal external user ID set via login().');
    } catch (error: any) {
        // Handle the case where the external user ID is already associated with another OneSignal user
        if (error?.status === 409 || error.message?.includes('Conflict')) {
            console.warn('⚠️ OneSignal login 409 conflict (race condition) – SDK will handle this async');
            return; 
        }
      console.error('❌ Failed to set OneSignal external user ID:', error);
      throw error;
    }
  }

  // FIXED: Updated to use OneSignal.logout() (new API, replaces removeExternalUserId)
  public async logout(): Promise<void> {
    try {
      await this.initialize();
      console.log('Removing OneSignal external user ID.');
      await window.OneSignal.logout();
      console.log('✅ OneSignal external user ID removed via logout().');
    } catch (error) {
      console.error('❌ Failed to process OneSignal logout (non-fatal):', error);
    }
  }

  private async doInitialize(): Promise<void> {
    if (this.initializing) return;
    
    this.initializing = true;

    try {
      await this.waitForOneSignal();

      console.log('🔔 Initializing OneSignal with app ID:', this.appId);
      
      // FIXED: Wrap in OneSignalDeferred.push for modern deferred loading (add <script defer> in HTML if needed)
      if (window.OneSignalDeferred) {
        await new Promise<void>((resolve, reject) => {
          window.OneSignalDeferred.push(async (OneSignal: any) => {
            try {
              await OneSignal.init({
                appId: this.appId,
                allowLocalhostAsSecureOrigin: true,
                serviceWorkerParam: { scope: '/onesignal/' },
                serviceWorkerPath: 'OneSignalSDKWorker.js',
                notifyButton: { enable: false },
                persistNotification: true,
                autoRegister: false, // We will register manually.
                safari_web_id: import.meta.env.VITE_SAFARI_WEB_ID,
                welcomeNotification: { disable: true },
                promptOptions: {
                  slidedown: {
                    prompts: [{
                      type: "push",
                      autoPrompt: false, // We will prompt manually.
                      text: {
                        actionMessage: "Enable notifications to receive real-time alerts",
                        acceptButton: "Allow",
                        cancelButton: "No Thanks"
                      }
                    }]
                  }
                }
              });
              resolve();
            } catch (error) {
              reject(error);
            }
          });
        });
      } else {
        // Fallback to direct init
        await window.OneSignal.init({
          appId: this.appId,
          allowLocalhostAsSecureOrigin: true,
          serviceWorkerParam: { scope: '/onesignal/' },
          serviceWorkerPath: 'OneSignalSDKWorker.js',
          notifyButton: { enable: false },
          persistNotification: true,
          autoRegister: false, // We will register manually.
          safari_web_id: import.meta.env.VITE_SAFARI_WEB_ID,
          welcomeNotification: { disable: true },
          promptOptions: {
            slidedown: {
              prompts: [{
                type: "push",
                autoPrompt: false, // We will prompt manually.
                text: {
                  actionMessage: "Enable notifications to receive real-time alerts",
                  acceptButton: "Allow",
                  cancelButton: "No Thanks"
                }
              }]
            }
          }
        });
      }

      this.initialized = true;
      console.log('✅ OneSignal initialized successfully');
      
    } catch (error: any) {
      console.error('❌ Failed to initialize OneSignal:', error);
      
      // FIXED: Skip retries for origin/config errors (prevents "already initialized" loop)
      if (error.message?.includes('origin') || error.message?.includes('restricted') || error.message?.includes('site URL')) {
        console.error('❌ Origin mismatch - configure Site URL in OneSignal Dashboard for this domain');
        throw new Error(`OneSignal origin mismatch: ${error.message}. Update dashboard Site URL to match current origin.`);
      }
      
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        this.initializing = false;
        this.initPromise = null;
        console.log(`🔄 Retrying OneSignal initialization (attempt ${this.retryCount}/${this.maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        return this.initialize();
      }
      
      console.error('❌ OneSignal initialization failed after all retries');
      // FIX: Throw the error to prevent silent failures.
      throw error;
    } finally {
      this.initializing = false;
    }
  }
  
  async setupForegroundNotifications(callback: (notification: any) => void): Promise<void> {
    await this.initialize();

    try {
      if (window.OneSignal?.Notifications) {
        window.OneSignal.Notifications.addEventListener('foregroundWillDisplay', (event: any) => {
          event.preventDefault();
          const notificationData = {
            id: event.notification?.notificationId || `fg-${Date.now()}`,
            oneSignalId: event.notification?.notificationId,
            title: event.notification?.title || 'Notification',
            message: event.notification?.body || '',
            data: event.notification?.additionalData || {},
            priority: event.notification?.priority || 5
          };
          callback(notificationData);
        });
      } else {
        console.warn('⚠️ OneSignal foreground notification API not available');
      }
    } catch (error) {
      console.error('❌ Failed to set up foreground notification listener:', error);
      throw error; // FIX: Propagate errors.
    }
  }

  private waitForOneSignal(): Promise<void> {
    return new Promise((resolve, reject) => {
      const maxAttempts = 50; // 5 seconds
      let attempts = 0;
      const checkOneSignal = () => {
        // FIXED: Also check for OneSignalDeferred
        if ((window.OneSignal && typeof window.OneSignal.init === 'function') || window.OneSignalDeferred) {
          resolve();
        } else if (attempts < maxAttempts) {
          attempts++;
          setTimeout(checkOneSignal, 100);
        } else {
          reject(new Error('OneSignal SDK failed to load in time.'));
        }
      };
      checkOneSignal();
    });
  }

  async isSubscribed(): Promise<boolean> {
    await this.initialize();
    if (!this.isPushSupported()) return false;

    try {
      if (window.OneSignal?.User?.PushSubscription) {
        const optedIn = await window.OneSignal.User.PushSubscription.optedIn;
        return Boolean(optedIn);
      }
      return false;
    } catch (error) {
      console.error('❌ Failed to check subscription status:', error);
      throw error; // FIX: Propagate errors.
    }
  }

  async getPlayerId(): Promise<string | null> {
    await this.initialize();
    if (!this.isPushSupported()) return null;

    try {
      const id = await window.OneSignal.User.PushSubscription.id;
      return id || null;
    } catch (error) {
      console.error('❌ Failed to get player ID:', error);
      throw error; // FIX: Propagate errors.
    }
  }

  async subscribe(): Promise<string | null> {
    await this.initialize();

    if (!this.isPushSupported()) {
      throw new Error('Push notifications are not supported in this browser.');
    }

    try {
      const hasPermission = await window.OneSignal.Notifications.requestPermission();
      if (!hasPermission) {
        throw new Error('Notification permission was not granted.');
      }

      await window.OneSignal.User.PushSubscription.optIn();
      
      let playerId = null;
      let attempts = 0;
      const maxAttempts = 10; // Wait for up to 10 seconds.
      
      while (!playerId && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        playerId = await this.getPlayerId();
        attempts++;
      }
      
      if (!playerId) {
        throw new Error('Failed to get a player ID after opting in. OneSignal might be experiencing issues.');
      }
      
      return playerId;
    } catch (error) {
      console.error('❌ Failed to subscribe to notifications:', error);
      throw error;
    }
  }

  async unsubscribe(): Promise<void> {
    await this.initialize();

    try {
      await window.OneSignal.User.PushSubscription.optOut();
    } catch (error) {
      console.error('❌ Failed to unsubscribe from notifications:', error);
      throw error;
    }
  }

  async setUserTags(tags: Record<string, string>): Promise<void> {
    await this.initialize();

    try {
      await window.OneSignal.User.addTags(tags);
    } catch (error: any) {
      // FIXED: Ignore 409 conflicts (known race; SDK retries async)
      if (error?.status === 409 || error.message?.includes('Conflict')) {
        console.warn('⚠️ OneSignal tags 409 conflict (race condition) – SDK will retry async');
        return; // Non-blocking: Tags sync eventually
      }
      console.error('❌ Failed to set user tags:', error);
      throw error;
    }
  }

  async removeUserTags(tagKeys: string[]): Promise<void> {
    await this.initialize();

    try {
      await window.OneSignal.User.removeTags(tagKeys);
    } catch (error) {
      console.error('❌ Failed to remove user tags:', error);
      throw error;
    }
  }

  async savePlayerIdToDatabase(userId: string): Promise<void> {
    const playerId = await this.getPlayerId();
    if (!playerId) {
      throw new Error('Cannot save to database: No player ID available.');
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
        // FIX: Add more context to database errors.
        throw new Error(`Database error saving player ID: ${error.message}`);
      }
    } catch (error) {
      console.error('❌ Failed to save player ID to database:', error);
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
        throw new Error(`Database error removing player ID: ${error.message}`);
      }
    } catch (error) {
      console.error('❌ Failed to remove player ID from database:', error);
      throw error;
    }
  }
  
  onSubscriptionChange(callback: (subscribed: boolean) => void): void {
    this.initialize().then(() => {
      try {
        window.OneSignal.User.PushSubscription.addEventListener('change', (event: any) => {
          callback(event?.current?.optedIn || false);
        });
      } catch (error) {
        console.error('❌ Failed to set up subscription change listener:', error);
      }
    }).catch(err => {
        console.error('❌ Initialization failed, cannot set up subscription listener:', err);
    });
  }
}
