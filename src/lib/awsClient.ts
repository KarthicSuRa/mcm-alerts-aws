
import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserSession,
} from 'amazon-cognito-identity-js';
import { CognitoIdentityClient } from "@aws-sdk/client-cognito-identity";
import { fromCognitoIdentityPool } from "@aws-sdk/credential-provider-cognito-identity";
import { User } from '../types';

// --- Configuration ---
const COGNITO_USER_POOL_ID = import.meta.env.VITE_COGNITO_USER_POOL_ID;
const COGNITO_CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID;
const API_GATEWAY_ENDPOINT = import.meta.env.VITE_API_GATEWAY_ENDPOINT;
const WEBSOCKET_API_ENDPOINT = import.meta.env.VITE_WEBSOCKET_API_ENDPOINT;
const AWS_REGION = import.meta.env.VITE_AWS_REGION;
const IDENTITY_POOL_ID = import.meta.env.VITE_IDENTITY_POOL_ID;

if (!COGNITO_USER_POOL_ID || !COGNITO_CLIENT_ID || !API_GATEWAY_ENDPOINT || !WEBSOCKET_API_ENDPOINT || !AWS_REGION || !IDENTITY_POOL_ID) {
  throw new Error("Missing AWS configuration. Make sure to set VITE_COGNITO_USER_POOL_ID, VITE_COGNITO_CLIENT_ID, VITE_API_GATEWAY_ENDPOINT, VITE_WEBSOCKET_API_ENDPOINT, VITE_AWS_REGION and VITE_IDENTITY_POOL_ID in your .env file.");
}

// --- AWS SDK and Cognito Setup ---
const userPool = new CognitoUserPool({
  UserPoolId: COGNITO_USER_POOL_ID,
  ClientId: COGNITO_CLIENT_ID,
});

const cognitoClient = new CognitoIdentityClient({ region: AWS_REGION });

// --- Main Client Class ---
class AWSClient {
  private static instance: AWSClient;
  private session: CognitoUserSession | null = null;
  private authStateChangeListeners: ((session: CognitoUserSession | null, user: User | null) => void)[] = [];

  private constructor() {}

  public static getInstance(): AWSClient {
    if (!AWSClient.instance) {
      AWSClient.instance = new AWSClient();
    }
    return AWSClient.instance;
  }

  // --- Authentication ---
  public signIn(email: string, password: string): Promise<{session: CognitoUserSession, user: User}> {
    return new Promise((resolve, reject) => {
      const authDetails = new AuthenticationDetails({ Username: email, Password: password });
      const cognitoUser = new CognitoUser({ Username: email, Pool: userPool });

      cognitoUser.authenticateUser(authDetails, {
        onSuccess: async (session) => {
          this.session = session;
          try {
            const user = await this.get('/profile');
            this.notifyAuthStateChange(session, user);
            resolve({ session, user });
          } catch (error) {
            reject(new Error('Failed to fetch profile after sign-in'));
          }
        },
        onFailure: (err) => {
          reject(err);
        },
      });
    });
  }

  public signOut(): void {
    const cognitoUser = userPool.getCurrentUser();
    if (cognitoUser) {
      cognitoUser.signOut();
    }
    this.session = null;
    this.notifyAuthStateChange(null, null);
  }

 public async getSession(): Promise<CognitoUserSession | null> {
    return new Promise((resolve, reject) => {
        const cognitoUser = userPool.getCurrentUser();
        if (!cognitoUser) {
            return resolve(null);
        }
        cognitoUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
            if (err) {
                // This can happen if the user is not authenticated
                return resolve(null);
            }
            if (session && session.isValid()) {
                this.session = session;
                resolve(session);
            } else {
                // Try to refresh session if it's expired
                if (session) {
                    const refreshToken = session.getRefreshToken();
                    cognitoUser.refreshSession(refreshToken, (err, newSession) => {
                        if (err) {
                            // Refresh token expired or invalid
                            resolve(null);
                        } else {
                            this.session = newSession;
                            resolve(newSession);
                        }
                    });
                } else {
                    resolve(null);
                }
            }
        });
    });
}

public async getCurrentUser(): Promise<User | null> {
    try {
        const session = await this.getSession();
        if (!session) return null;
        return await this.get('/profile');
    } catch (error) {
        console.error("Error fetching current user:", error);
        return null;
    }
}


  public onAuthStateChange(callback: (session: CognitoUserSession | null, user: User | null) => void): () => void {
    this.authStateChangeListeners.push(callback);
    // Immediately call with current session and user
    Promise.all([this.getSession(), this.getCurrentUser()])
        .then(([session, user]) => callback(session, user))
        .catch(() => callback(null, null));

    return () => {
      this.authStateChangeListeners = this.authStateChangeListeners.filter(listener => listener !== callback);
    };
  }

  private notifyAuthStateChange(session: CognitoUserSession | null, user: User | null) {
    this.authStateChangeListeners.forEach((listener) => listener(session, user));
  }

  // --- API Gateway ---

  private async getAuthToken(): Promise<string | null> {
    if (this.session && this.session.isValid()) {
      return this.session.getIdToken().getJwtToken();
    }
    const newSession = await this.getSession();
    return newSession ? newSession.getIdToken().getJwtToken() : null;
  }

  public async get(path: string, params: Record<string, any> = {}): Promise<any> {
    const token = await this.getAuthToken();
    // If no token and the path is not public, throw an error
    if (!token && !['/public-path'].includes(path)) {
        // You might want to have a list of public paths
        throw new Error('Authentication required');
    }
    const query = new URLSearchParams(params).toString();
    const response = await fetch(`${API_GATEWAY_ENDPOINT}${path}?${query}`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!response.ok) throw new Error(`API GET request failed: ${response.statusText}`);
    return response.json();
  }

  public async post(path: string, body: Record<string, any>): Promise<any> {
    const token = await this.getAuthToken();
    if (!token) throw new Error('Authentication required');
    const response = await fetch(`${API_GATEWAY_ENDPOINT}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`API POST request to ${path} failed: ${response.status} ${response.statusText} - ${errorBody}`);
    }
    return response.json();
  }
  
  public async put(path: string, body: Record<string, any>): Promise<any> {
    const token = await this.getAuthToken();
    if (!token) throw new Error('Authentication required');
    const response = await fetch(`${API_GATEWAY_ENDPOINT}${path}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`API PUT request failed: ${response.statusText}`);
    return response.json();
  }

  public async delete(path: string): Promise<any> {
    const token = await this.getAuthToken();
    if (!token) throw new Error('Authentication required');
    const response = await fetch(`${API_GATEWAY_ENDPOINT}${path}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`
      },
    });
    if (!response.ok) throw new Error(`API DELETE request failed: ${response.statusText}`);
    return response.json();
  }

  // --- WebSocket ---

  public connectWebSocket(onMessage: (data: any) => void): () => void {
    if (!WEBSOCKET_API_ENDPOINT) {
      console.error("WebSocket API endpoint is not configured.");
      return () => {};
    }

    let socket: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    const connect = () => {
      console.log("Attempting to connect to WebSocket...");
      this.getAuthToken().then(token => {
        if (!token) {
            console.log("No auth token for WebSocket, retrying...");
            if (reconnectTimeout) clearTimeout(reconnectTimeout);
            reconnectTimeout = setTimeout(connect, 5000);
            return;
        }

        const socketUrl = `${WEBSOCKET_API_ENDPOINT}?token=${token}`;
        socket = new WebSocket(socketUrl);

        socket.onopen = () => {
            console.log("WebSocket connected.");
            if (reconnectTimeout) {
            clearTimeout(reconnectTimeout);
            reconnectTimeout = null;
            }
        };

        socket.onmessage = (event) => {
            try {
            const data = JSON.parse(event.data);
            onMessage(data);
            } catch (error) {
            console.error("Failed to parse WebSocket message:", error);
            }
        };

        socket.onclose = () => {
            console.log("WebSocket disconnected.");
            if (!reconnectTimeout) {
                reconnectTimeout = setTimeout(connect, 5000);
            }
        };

        socket.onerror = (error) => {
            console.error("WebSocket error:", error);
            socket?.close();
        };
      }).catch(error => {
        console.error("Could not get auth token for WebSocket:", error);
        if (reconnectTimeout) clearTimeout(reconnectTimeout);
        reconnectTimeout = setTimeout(connect, 5000);
      });
    };

    connect();

    return () => {
      console.log("Manually closing WebSocket connection.");
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }
      socket?.close();
    };
  }

  // --- Push Notifications ---
  public async registerDevice(playerId: string): Promise<void> {
    await this.post('/devices', { playerId });
  }
}

export const awsClient = AWSClient.getInstance();
