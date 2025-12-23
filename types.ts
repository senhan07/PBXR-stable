

export interface Label {
  key: string;
  value: string;
}

export interface Prober {
  id: string;
  name: string;
  url: string; // The URL of the blackbox exporter instance
  modules: string[]; // e.g., ['http_2xx', 'icmp']
  region?: string;
  scrapeInterval?: string; // e.g., '15s'
}

export interface TargetGroup {
  id: string;
  name: string;
  description?: string;
  color?: string; // hex for UI decoration
  icon?: string;
}

export interface Target {
  id: string;
  name: string;
  url: string; // The actual target URL to probe
  proberIds: string[]; // Assigned probers
  labels: Label[];
  module: string; // The blackbox module to use
  groupId?: string; // Link to TargetGroup
  enabled?: boolean;
  interval?: string;
  lastScrape?: string;
  lastError?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserSession {
  ip: string;
  userAgent: string;
  lastActive: string;
  id?: string;
}

export interface User {
  id: string;
  username: string;
  password?: string; // Optional for current user context, required in storage
  role: 'admin' | 'viewer' | 'editor';
  avatarUrl?: string;
  sessions?: UserSession[];
  activeSessionId?: string;
}

export interface PasswordPolicy {
  minLength: number;
  requireSpecialChar: boolean;
  requireNumber: boolean;
}

export interface TargetsEndpointConfig {
  enabled: boolean;
  authRequired: boolean;
  authToken?: string;
}

export interface PrometheusEndpointConfig {
  enabled: boolean;
  authRequired: boolean;
  authToken?: string;
  proberSpecificTokens?: Record<string, string>; // Map proberId -> token
}

export interface AppConfig {
  prometheusUrl: string;
  scrapeInterval: string;
  promAuthMethod: 'none' | 'basic' | 'bearer';
  promAuthCredentials?: string; // stored as string (token or username:password)
  passwordPolicy: PasswordPolicy;
  logRetentionDays: number;
  autoLogoutMinutes: number;
  targetsEndpoint: TargetsEndpointConfig;
  prometheusEndpoint: PrometheusEndpointConfig;
  prometheusTemplate?: string; // YAML template for /prometheus endpoints
}

export interface AppEvent {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  message: string;
  timestamp: string;
  user?: string;
}

export interface AppState {
  users: User[];
  currentUser: User | null;
  probers: Prober[];
  targets: Target[];
  targetGroups: TargetGroup[];
  config: AppConfig;
  events: AppEvent[];
}

export type AppAction =
  | { type: 'SET_USER'; payload: User }
  | { type: 'LOGOUT' }
  | { type: 'LOGIN_FAILURE'; payload: { username: string; ip: string; userAgent: string } }
  | { type: 'ADD_PROBER'; payload: Prober }
  | { type: 'UPDATE_PROBER'; payload: Prober }
  | { type: 'DELETE_PROBER'; payload: string }
  | { type: 'ADD_TARGET'; payload: Target }
  | { type: 'UPDATE_TARGET'; payload: Target }
  | { type: 'BATCH_ADD_TARGETS'; payload: Target[] }
  | { type: 'BATCH_UPDATE_TARGETS'; payload: Target[] }
  | { type: 'BATCH_DELETE_TARGETS'; payload: string[] }
  | { type: 'DELETE_TARGET'; payload: string }
  | { type: 'ADD_GROUP'; payload: TargetGroup }
  | { type: 'UPDATE_GROUP'; payload: TargetGroup }
  | { type: 'DELETE_GROUP'; payload: string }
  | { type: 'ADD_USER'; payload: User }
  | { type: 'UPDATE_USER'; payload: User }
  | { type: 'ADD_USER_SESSION'; payload: { userId: string; session: UserSession } }
  | { type: 'DELETE_USER'; payload: string }
  | { type: 'UPDATE_CONFIG'; payload: AppConfig }
  | { type: 'IMPORT_DATA'; payload: Partial<AppState> }
  | { type: 'UPDATE_TARGET_STATUSES'; payload: { id: string; status: 'up' | 'down' | 'unknown'; lastScrape: string; lastError?: string }[] }
  | { type: 'MERGE_EVENTS'; payload: AppEvent[] };