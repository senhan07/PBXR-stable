import React, { useState, useReducer, useEffect } from 'react';
import { uuid } from './utils/uuid';
import { 
  LayoutDashboard, 
  Target as TargetIcon, 
  Server, 
  Settings as SettingsIcon, 
  Trash2, 
  LogOut,
  TerminalSquare,
  Users,
  ShieldAlert,
  Check,
  Tags,
  ScrollText,
  KeyRound,
  ArrowRight
} from 'lucide-react';
import { INITIAL_STATE } from './constants';
import { AppState, AppAction, User, AppEvent } from './types';
import { Dashboard } from './components/Dashboard';
import { ProberManagement } from './components/ProberManagement';
import { TargetManagement } from './components/TargetManagement';
import { LabelManagement } from './components/LabelManagement';
import { MetricCleaner } from './components/MetricCleaner';
import { Settings } from './components/Settings';
import { UserManagement } from './components/UserManagement';
import { EventLog } from './components/EventLog';
import { Toaster } from './components/Toaster';

// Helper for constant-time comparison to prevent timing attacks on tokens
const secureCompare = (a: string, b: string) => {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    let mismatch = a.length === b.length ? 0 : 1;
    if (mismatch) {
        b = a; // Equalize lengths to prevent loop optimization leakage
    }
    for (let i = 0; i < a.length; ++i) {
        mismatch |= (a.charCodeAt(i) ^ b.charCodeAt(i));
    }
    return mismatch === 0;
};

// Reducer for state management
function appReducer(state: AppState, action: AppAction): AppState {
  // Helper to create events and enforce retention policy
  const updateEvents = (msg: string, type: 'info'|'success'|'warning'|'error' = 'info', userContext?: string) => {
    const newEvent: AppEvent = {
      id: uuid(),
      message: msg,
      type,
      timestamp: new Date().toISOString(),
      user: userContext || state.currentUser?.username || (action.type === 'SET_USER' ? action.payload.username : 'system')
    };

    const allEvents = [newEvent, ...state.events];
    
    // Enforce Retention Policy
    const retentionDays = state.config.logRetentionDays || 30;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    
    return allEvents.filter(e => new Date(e.timestamp) > cutoffDate);
  };

  switch (action.type) {
    case 'SET_USER': 
      // SET_USER should only set the current user context; login events
      // are emitted by `ADD_USER_SESSION` to avoid duplicate 'logged in' events.
      return { 
        ...state, 
        currentUser: action.payload
      };
    
    case 'LOGIN_FAILURE':
        return {
            ...state,
            events: updateEvents(
                `Failed login attempt for user '${action.payload.username}' from IP ${action.payload.ip}. User Agent: ${action.payload.userAgent}`, 
                'warning', 
                'system'
            )
        };
    case 'LOGOUT': 
        return { 
            ...state, 
            currentUser: null,
            events: updateEvents(`User ${state.currentUser?.username} logged out`, 'info')
        };
    case 'ADD_PROBER': 
        return { 
            ...state, 
            probers: [...state.probers, action.payload],
            events: updateEvents(`Prober ${action.payload.name} added`, 'success')
        };
    case 'UPDATE_PROBER': 
        return { 
            ...state, 
            probers: state.probers.map(p => p.id === action.payload.id ? action.payload : p),
            events: updateEvents(`Prober ${action.payload.name} updated`, 'info')
        };
    case 'DELETE_PROBER': {
        const p = state.probers.find(p => p.id === action.payload);
        return { 
            ...state, 
            probers: state.probers.filter(p => p.id !== action.payload),
            events: updateEvents(`Prober ${p?.name || 'Unknown'} deleted`, 'warning')
        };
    }
    case 'ADD_TARGET': 
      const now = new Date().toISOString();
      return { 
        ...state, 
        targets: [...state.targets, { ...action.payload, createdAt: now, updatedAt: now }],
        events: updateEvents(`Target ${action.payload.name} created`, 'success')
      };
    case 'UPDATE_TARGET': 
      return { 
        ...state, 
        targets: state.targets.map(t => t.id === action.payload.id ? { ...action.payload, createdAt: t.createdAt || t.createdAt, updatedAt: new Date().toISOString() } : t),
        events: updateEvents(`Target ${action.payload.name} updated`, 'info')
      };
    case 'BATCH_ADD_TARGETS':
      const tsNow = new Date().toISOString();
      return {
        ...state,
        targets: [...state.targets, ...action.payload.map(t => ({ ...t, createdAt: tsNow, updatedAt: tsNow }))],
        events: updateEvents(`Batch added ${action.payload.length} targets`, 'success')
      };
    case 'BATCH_UPDATE_TARGETS':
      // Updates existing targets with matching IDs from payload and set updatedAt
      const updatesMap = new Map(action.payload.map(t => [t.id, t]));
      return {
        ...state,
        targets: state.targets.map(t => {
          const upd = updatesMap.get(t.id);
          return upd ? { ...t, ...upd, updatedAt: new Date().toISOString() } : t;
        }),
        events: updateEvents(`Batch update applied to ${action.payload.length} targets`, 'warning')
      };
    case 'BATCH_DELETE_TARGETS':
        return {
            ...state,
            targets: state.targets.filter(t => !action.payload.includes(t.id)),
            events: updateEvents(`Batch deleted ${action.payload.length} targets`, 'warning')
        };
    case 'DELETE_TARGET': {
        const t = state.targets.find(t => t.id === action.payload);
        return { 
            ...state, 
            targets: state.targets.filter(t => t.id !== action.payload),
            events: updateEvents(`Target ${t?.name || 'Unknown'} deleted`, 'warning')
        };
    }
    case 'ADD_GROUP':
        return {
            ...state,
            targetGroups: [...(state.targetGroups || []), action.payload],
            events: updateEvents(`Folder ${action.payload.name} created`, 'success')
        };
    case 'UPDATE_GROUP':
        return {
            ...state,
            targetGroups: state.targetGroups.map(g => g.id === action.payload.id ? action.payload : g),
            events: updateEvents(`Folder ${action.payload.name} updated`, 'info')
        };
    case 'DELETE_GROUP':
        return {
            ...state,
            targetGroups: state.targetGroups.filter(g => g.id !== action.payload),
            // Unlink targets in this group
            targets: state.targets.map(t => t.groupId === action.payload ? { ...t, groupId: undefined } : t),
            events: updateEvents(`Folder deleted`, 'warning')
        };
    case 'ADD_USER': 
        return { 
            ...state, 
            users: [...state.users, action.payload],
            events: updateEvents(`User ${action.payload.username} registered`, 'success')
        };
    case 'UPDATE_USER':
      {
        const existing = state.users.find(u => u.id === action.payload.id);
        // Avoid logging profile updated if only sessions changed or if nothing changed
        const strip = (u?: any) => {
          if (!u) return {};
          const { sessions, password, ...rest } = u;
          return rest;
        };
        const before = JSON.stringify(strip(existing));
        const after = JSON.stringify(strip(action.payload));
        const newEvents = before !== after ? updateEvents(`User ${action.payload.username} profile updated`, 'info') : state.events;
        return {
          ...state,
          users: state.users.map(u => u.id === action.payload.id ? action.payload : u),
          events: newEvents
        };
      }
    case 'ADD_USER_SESSION':
      {
        const { userId, session } = action.payload;
        const users = state.users.map(u => {
          if (u.id !== userId) return u;
          const sessions = [...(u.sessions || []), session];
          return { ...u, sessions };
        });
        const user = state.users.find(u => u.id === userId);
        const ip = session?.ip || 'unknown';
        const ua = session?.userAgent || '';
        const shortUa = ua.length > 80 ? ua.slice(0, 77) + '...' : ua;
        const events = updateEvents(`User ${user?.username || userId} logged in (IP: ${ip}${shortUa ? `, UA: ${shortUa}` : ''})`, 'success', user?.username);
        return { ...state, users, events };
      }
    case 'DELETE_USER': 
        return { 
            ...state, 
            users: state.users.filter(u => u.id !== action.payload),
            events: updateEvents(`User account deleted`, 'warning')
        };
    case 'UPDATE_CONFIG': {
      // Specifically enforce retention immediately upon config change
      const newState = { ...state, config: action.payload };
      const retentionDays = action.payload.logRetentionDays || 30;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
      const filteredEvents = state.events.filter(e => new Date(e.timestamp) > cutoffDate);

      // Create a detailed diff of changed config fields
      const diffs: string[] = [];
      const oldCfg = state.config || {} as any;
      const newCfg = action.payload as any;
      const keysToCheck = Array.from(new Set([...Object.keys(oldCfg), ...Object.keys(newCfg)]));
      keysToCheck.forEach(k => {
        const oldVal = JSON.stringify(oldCfg[k]);
        const newVal = JSON.stringify(newCfg[k]);
        if (oldVal !== newVal) {
          diffs.push(`${k}: ${oldVal} -> ${newVal}`);
        }
      });

      const configUpdateEvent: AppEvent = {
        id: uuid(),
        message: diffs.length > 0 ? `System configuration updated: ${diffs.join('; ')}` : `System configuration updated (no visible changes)`,
        type: 'warning',
        timestamp: new Date().toISOString(),
        user: state.currentUser?.username || 'system'
      };

      return { 
        ...newState, 
        events: [configUpdateEvent, ...filteredEvents]
      };
    }
    case 'IMPORT_DATA': 
        // When importing state from server, preserve the server's events array instead of
        // calling updateEvents (which would only prepend to the local state's events and
        // effectively drop the server-provided events). Prepend a single import marker
        // event to the server events list for auditability.
        {
          const imported = action.payload || {} as any;
          const incomingEvents: AppEvent[] = Array.isArray(imported.events) ? imported.events : [];
          const importMarker: AppEvent = {
            id: uuid(),
            message: 'System state imported from backup',
            type: 'warning',
            timestamp: new Date().toISOString(),
            user: 'system'
          };

          // Avoid adding duplicate import markers when the server-provided events
          // already include such a marker (common on refresh). If an import marker
          // with the same message exists, skip prepending another one.
          const hasImportMarker = incomingEvents.some(ev => ev && typeof ev.message === 'string' && ev.message.includes('System state imported from backup'));

          return {
            ...state,
            ...imported,
            targetGroups: imported.targetGroups || state.targetGroups || [],
            config: {
              ...state.config,
              ...imported.config,
              targetsEndpoint: imported.config?.targetsEndpoint || state.config.targetsEndpoint || { enabled: false, authRequired: false, authToken: '' },
              prometheusEndpoint: imported.config?.prometheusEndpoint || state.config.prometheusEndpoint || { enabled: false, authRequired: false, authToken: '', proberSpecificTokens: {} },
              prometheusTemplate: imported.config?.prometheusTemplate || state.config.prometheusTemplate
            },
            events: hasImportMarker ? incomingEvents : [importMarker, ...incomingEvents]
          };
        }
    case 'UPDATE_TARGET_STATUSES': 
      return { 
        ...state, 
        targets: state.targets.map(t => {
          const update = action.payload.find(u => u.id === t.id);
          return update ? { ...t, ...update } : t;
        }) 
      };
    case 'MERGE_EVENTS': {
      const incoming: AppEvent[] = Array.isArray(action.payload) ? action.payload : [];
      const map = new Map<string, AppEvent>();
      // Add incoming first (prefer newest), keyed by id or message+timestamp
      (incoming || []).forEach(ev => {
        if (!ev) return;
        const key = ev.id || `${ev.message || ''}__${ev.timestamp || ''}`;
        map.set(key, ev);
      });
      // Add existing if not present
      (state.events || []).forEach(ev => {
        if (!ev) return;
        const key = ev.id || `${ev.message || ''}__${ev.timestamp || ''}`;
        if (!map.has(key)) map.set(key, ev);
      });
      const merged = Array.from(map.values()).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      return { ...state, events: merged };
    }
    default: return state;
  }
}

const App: React.FC = () => {
  const [state, dispatch] = useReducer(appReducer, INITIAL_STATE);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'targets' | 'probers' | 'labels' | 'cleaner' | 'users' | 'settings' | 'events'>('dashboard');
  
  // Login State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [serverAvailable, setServerAvailable] = useState<boolean | null>(null);
  const prevServerAvailable = React.useRef<boolean | null>(null);

  // Notify user when server connectivity changes (show toast on disconnect/reconnect)
  useEffect(() => {
    if (prevServerAvailable.current === null) {
      prevServerAvailable.current = serverAvailable;
      return;
    }
    if (prevServerAvailable.current === true && serverAvailable === false) {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: 'Lost connection to server — running in offline mode', type: 'error' } }));
    }
    if (prevServerAvailable.current === false && serverAvailable === true) {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: 'Reconnected to server', type: 'success' } }));
    }
    prevServerAvailable.current = serverAvailable;
  }, [serverAvailable]);

  // Auto Logout State
  const [lastActivity, setLastActivity] = useState(Date.now());
  const [timeLeft, setTimeLeft] = useState<string>('');

  // Persistence logic (Server DB + LocalStorage Fallback)
  useEffect(() => {
    // Attempt to load from Server DB first
    fetch('/api/state')
      .then(res => {
        if (!res.ok) throw new Error('Server sync failed');
        return res.json();
      })
      .then(serverData => {
        if (serverData) {
            // Server has saved state — load it as source of truth
            setServerAvailable(true);
            dispatch({ type: 'IMPORT_DATA', payload: serverData });
            console.log("Loaded state from persistent DB");
          } else {
          // Server returned no state (fresh DB). Do NOT auto-import localStorage here
          // to avoid repopulating the DB unintentionally when a user deletes the .db file.
          // Also treat a fresh DB as 'unavailable' for client sync so clients won't POST their local state.
          setServerAvailable(false);
          console.log("No data on server (fresh DB). Starting with clean state.");
        }
        setIsDataLoaded(true);
      })
      .catch(err => {
        // Server unreachable — mark unavailable and continue with in-memory state only.
        console.warn("Could not connect to backend DB.", err);
        setServerAvailable(false);
        // Do not import from localStorage — all state should be server-authoritative.
        setIsDataLoaded(true);
      });
  }, []);

  useEffect(() => {
    if (!isDataLoaded) return;
    // Prepare state for server: never persist currentUser on server-side
    const stateForServer = { ...state } as any;
    stateForServer.currentUser = null;

    // Sync to Backend DB only if server was reachable when we checked earlier.
    if (serverAvailable) {
      fetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(stateForServer)
      }).catch(e => console.error("Background sync failed", e));
    }

  }, [state, isDataLoaded]);

  // Poll server state for connectivity, events, and session validation.
  useEffect(() => {
    if (!isDataLoaded) return; // Wait for initial data load.
    let stopped = false;

    const pollServerState = async () => {
      try {
        const res = await fetch('/api/state');
        if (!res.ok) throw new Error('Server poll failed');

        // Connection succeeded
        if (!serverAvailable) setServerAvailable(true);

        const serverState = await res.json();
        if (stopped || !serverState) return;

        // 1. Merge Events
        if (Array.isArray(serverState.events)) {
          dispatch({ type: 'MERGE_EVENTS', payload: serverState.events });
        }

        // 2. Check for session revocation
        if (state.currentUser) {
            const serverUser = (serverState.users || []).find((u: any) => u.id === state.currentUser!.id);
            if (!serverUser || !(serverUser.sessions && serverUser.sessions.length > 0)) {
              dispatch({ type: 'LOGOUT' });
            }
        }

      } catch (e) {
        // Connection failed
        if (serverAvailable) {
            console.warn('Server poll failed, connection lost.');
            setServerAvailable(false);
        }
      }
    };

    pollServerState();
    const id = setInterval(pollServerState, 5000); // Poll every 5 seconds for less noise
    return () => { stopped = true; clearInterval(id); };
  }, [isDataLoaded, serverAvailable, state.currentUser]);

  // --- Auto Logout Logic ---
  useEffect(() => {
      const handleActivity = () => setLastActivity(Date.now());
      
      // Listeners for activity (excluding mousemove as requested)
      window.addEventListener('mousedown', handleActivity);
      window.addEventListener('keydown', handleActivity);
      window.addEventListener('scroll', handleActivity, true);
      window.addEventListener('touchstart', handleActivity);
      
      return () => {
        window.removeEventListener('mousedown', handleActivity);
        window.removeEventListener('keydown', handleActivity);
        window.removeEventListener('scroll', handleActivity, true);
        window.removeEventListener('touchstart', handleActivity);
      };
  }, []);

  useEffect(() => {
      if (!state.currentUser || !state.config.autoLogoutMinutes || state.config.autoLogoutMinutes <= 0) {
          setTimeLeft('');
          return;
      }
      
      const interval = setInterval(() => {
          const now = Date.now();
          const elapsed = now - lastActivity;
          const limit = state.config.autoLogoutMinutes * 60 * 1000;
          const remaining = Math.max(0, limit - elapsed);
          
          if (remaining === 0) {
              dispatch({ type: 'LOGOUT' });
              setLastActivity(Date.now()); // Reset for next login
          }
          
          const m = Math.floor(remaining / 60000);
          const s = Math.floor((remaining % 60000) / 1000);
          setTimeLeft(`${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
      }, 1000);
      
      return () => clearInterval(interval);
  }, [state.currentUser, state.config.autoLogoutMinutes, lastActivity]);

    const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setLoginError(err.error || 'Invalid credentials');
        // Log failed attempt via reducer for audit
        let mockIp = `192.168.1.${Math.floor(Math.random() * 255)}`;
        let clientUa = typeof navigator !== 'undefined' ? navigator.userAgent : '';
        try {
          const info = await fetch('/api/client-info');
          if (info.ok) {
            const d = await info.json();
            if (d.ip) mockIp = (d.ip as string).replace(/^::ffff:/, '');
            if (d.userAgent) clientUa = d.userAgent;
          }
        } catch (err) { /* ignore */ }
        dispatch({ type: 'LOGIN_FAILURE', payload: { username: username || 'unknown', ip: mockIp, userAgent: clientUa } });
        return;
      }

      const data = await res.json();
      const returnedUser = data.user;
      const sessionId = data.sessionId;
      if (!returnedUser) {
        setLoginError('Login failed');
        return;
      }

      // Determine session object returned from server (if present)
      let sess: any = null;
      if (Array.isArray(returnedUser.sessions) && returnedUser.sessions.length > 0) {
        sess = returnedUser.sessions.find((s: any) => s.id === sessionId) || returnedUser.sessions[returnedUser.sessions.length - 1];
      }
      if (!sess) {
        sess = { id: sessionId, ip: '', userAgent: '', lastActive: new Date().toISOString() };
      }

      // Ensure local users list contains the session to avoid server-side overwrite removing it
      const localUser = state.users.find(u => u.id === returnedUser.id);
      if (localUser) {
        const already = (localUser.sessions || []).some(s => s && s.id === sessionId);
        if (!already) {
          dispatch({ type: 'ADD_USER_SESSION', payload: { userId: returnedUser.id, session: sess } });
        }
      }

      // Set current user (server is authoritative about sessions)
      const userWithSession = { ...returnedUser, activeSessionId: sessionId } as any;
      dispatch({ type: 'SET_USER', payload: userWithSession });

      setActiveTab('dashboard');
      setLoginError('');
      setUsername('');
      setPassword('');
      setLastActivity(Date.now());
    } catch (err) {
      console.error('Login request failed', err);
      setLoginError('Login failed');
    }
    };

  // --- LOGIN SCREEN ---
  if (!state.currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-[#050507]">
        {/* Background Effects */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(59,130,246,0.15),transparent_50%)]"></div>
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 mix-blend-overlay"></div>
        
        <div className="w-full max-w-md relative z-10">
            {/* Logo Section */}
            <div className="mb-8 text-center">
                 <h1 className="text-4xl font-bold text-white tracking-tight mb-2">PBXR</h1>
                 <p className="text-gray-500 text-sm">Manage your monitoring targets</p>
            </div>

            {/* Login Card */}
            <div className="bg-[#0f0f11]/60 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl relative overflow-hidden animate-slide-up">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600"></div>
                
                <form onSubmit={handleLogin} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Identity</label>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <Users className="h-4 w-4 text-gray-500 group-focus-within:text-blue-500 transition-colors" />
                            </div>
                            <input 
                                type="text"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                className="w-full bg-[#18181b] border border-white/10 rounded-xl pl-11 pr-4 py-3.5 text-white placeholder-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all outline-none text-sm"
                                placeholder="Username"
                                autoFocus
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between items-center ml-1">
                             <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Credentials</label>
                        </div>
                        <div className="relative group">
                             <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <KeyRound className="h-4 w-4 text-gray-500 group-focus-within:text-blue-500 transition-colors" />
                             </div>
                            <input 
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="w-full bg-[#18181b] border border-white/10 rounded-xl pl-11 pr-4 py-3.5 text-white placeholder-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all outline-none text-sm"
                                placeholder="Password"
                            />
                        </div>
                    </div>

                    {loginError && (
                        <div className="flex items-center gap-3 text-red-400 text-sm bg-red-500/5 p-4 rounded-xl border border-red-500/10 animate-slide-up">
                            <ShieldAlert className="w-5 h-5 shrink-0" />
                            <span className="font-medium">{loginError}</span>
                        </div>
                    )}

                    <button 
                        type="submit"
                        className="w-full bg-white hover:bg-gray-100 text-black font-bold py-3.5 rounded-xl text-sm transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 mt-2 flex items-center justify-center gap-2 group"
                    >
                        <span>Login</span>
                        <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                    </button>
                </form>
            </div>
        </div>
      </div>
    );
  }

  // --- MENU CONFIG ---
  const mainMenu = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, allowed: ['admin', 'editor', 'viewer'] },
    { id: 'targets', label: 'Targets', icon: TargetIcon, allowed: ['admin', 'editor', 'viewer'] },
    { id: 'probers', label: 'Probers', icon: Server, allowed: ['admin', 'editor', 'viewer'] },
    { id: 'labels', label: 'Labels', icon: Tags, allowed: ['admin', 'editor', 'viewer'] },
    { id: 'cleaner', label: 'Metrics Ops', icon: Trash2, allowed: ['admin', 'editor'] },
    { id: 'events', label: 'Event Log', icon: ScrollText, allowed: ['admin', 'editor', 'viewer'] },
  ];

  const adminMenu = [
    { id: 'users', label: 'User Management', icon: Users, allowed: ['admin'] },
    { id: 'settings', label: 'System Config', icon: SettingsIcon, allowed: ['admin'] },
  ];

  // --- MAIN LAYOUT ---
  return (
    <div className="flex-1 flex overflow-hidden">
      <Toaster />
      
      {/* Sidebar */}
      <aside className="w-64 bg-[#08080a] border-r border-white/5 flex flex-col z-30">
        <div className="h-16 flex items-center gap-3 px-6 border-b border-white/5">
          <div className="w-8 h-8 bg-blue-600/20 rounded flex items-center justify-center text-blue-500">
             <TerminalSquare className="w-5 h-5" />
          </div>
          <span className="font-bold text-xl text-white tracking-wide">PBXR</span>
        </div>
        
        <nav className="flex-1 px-3 py-6 space-y-1">
          {mainMenu.filter(item => item.allowed.includes(state.currentUser!.role)).map(item => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id as any); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium mb-1 ${
                  isActive
                    ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20 shadow-glow' 
                    : 'text-gray-400 hover:bg-white/5 hover:text-gray-200 border border-transparent'
                }`}
              >
                <item.icon className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-gray-500'}`} />
                <span>{item.label}</span>
              </button>
            )
          })}

          {adminMenu.some(item => item.allowed.includes(state.currentUser!.role)) && (
            <div className="pt-4 mt-4 border-t border-white/5">
                <p className="px-4 text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-2">Administration</p>
                {adminMenu.filter(item => item.allowed.includes(state.currentUser!.role)).map(item => {
                    const isActive = activeTab === item.id;
                    return (
                    <button
                        key={item.id}
                        onClick={() => { setActiveTab(item.id as any); }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium mb-1 ${
                        isActive
                            ? 'bg-purple-600/10 text-purple-400 border border-purple-500/20 shadow-[0_0_15px_-5px_rgba(168,85,247,0.3)]' 
                            : 'text-gray-400 hover:bg-white/5 hover:text-gray-200 border border-transparent'
                        }`}
                    >
                        <item.icon className={`w-4 h-4 ${isActive ? 'text-purple-400' : 'text-gray-500'}`} />
                        <span>{item.label}</span>
                    </button>
                    )
                })}
            </div>
          )}
        </nav>

        <div className="p-4 border-t border-white/5 relative">
          {/* Auto Logout Timer placed above user profile */}
          {state.currentUser && state.config.autoLogoutMinutes > 0 && timeLeft && (
             <div className="mb-3 bg-black/40 border border-white/5 px-3 py-1.5 rounded-lg flex items-center gap-2 text-[10px] font-mono text-gray-400 animate-fade-in">
                <div className={`w-1.5 h-1.5 rounded-full ${parseInt(timeLeft.replace(':', '')) < 100 ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`}></div>
                <span>AUTO-LOGOUT IN {timeLeft}</span>
             </div>
          )}
          
          <div className="flex items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/5">
             <div className="relative">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-700 to-black flex items-center justify-center text-xs font-bold text-white border border-white/10">
                    {state.currentUser.username.charAt(0).toUpperCase()}
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-[#08080a] rounded-full"></div>
             </div>
             <div className="flex-1 overflow-hidden">
               <p className="text-xs font-bold text-white truncate">{state.currentUser.username}</p>
               <p className="text-xs text-gray-500 font-mono uppercase truncate">{state.currentUser.role}</p>
             </div>
             <button onClick={() => dispatch({type: 'LOGOUT'})} className="text-gray-500 hover:text-white transition-colors"><LogOut className="w-4 h-4" /></button>
          </div>
        </div>
      </aside>

      {/* Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#050507]">
        

        {/* Viewport */}
        <div className="p-8 flex-1 overflow-auto">

          <div className="animate-fade-in h-full">
            {activeTab === 'dashboard' && <Dashboard state={state} />}
            
            {activeTab === 'targets' && (
              <TargetManagement 
                targets={state.targets}
                targetGroups={state.targetGroups || []}
                probers={state.probers}
                onAdd={(t) => dispatch({ type: 'ADD_TARGET', payload: t })}
                onBatchAdd={(ts) => dispatch({ type: 'BATCH_ADD_TARGETS', payload: ts })}
                onUpdate={(t) => dispatch({ type: 'UPDATE_TARGET', payload: t })}
                onDelete={(id) => dispatch({ type: 'DELETE_TARGET', payload: id })}
                onBatchUpdate={(ts) => dispatch({ type: 'BATCH_UPDATE_TARGETS', payload: ts })}
                onBatchDelete={(ids) => dispatch({ type: 'BATCH_DELETE_TARGETS', payload: ids })}
                onAddGroup={(g) => dispatch({ type: 'ADD_GROUP', payload: g })}
                onUpdateGroup={(g) => dispatch({ type: 'UPDATE_GROUP', payload: g })}
                onDeleteGroup={(id) => dispatch({ type: 'DELETE_GROUP', payload: id })}
                userRole={state.currentUser.role}
              />
            )}

            {activeTab === 'probers' && (
              <ProberManagement 
                probers={state.probers}
                onAdd={(p) => dispatch({ type: 'ADD_PROBER', payload: p })}
                onUpdate={(p) => dispatch({ type: 'UPDATE_PROBER', payload: p })}
                onDelete={(id) => dispatch({ type: 'DELETE_PROBER', payload: id })}
                userRole={state.currentUser.role}
              />
            )}

            {activeTab === 'labels' && (state.currentUser.role === 'admin' || state.currentUser.role === 'editor' || state.currentUser.role === 'viewer') && (
              <LabelManagement 
                targets={state.targets}
                onBatchUpdate={(targets) => dispatch({ type: 'BATCH_UPDATE_TARGETS', payload: targets })}
                userRole={state.currentUser.role}
              />
            )}

            {activeTab === 'cleaner' && (state.currentUser.role === 'admin' || state.currentUser.role === 'editor') && (
              <MetricCleaner targets={state.targets} prometheusConfig={state.config} />
            )}

            {activeTab === 'events' && (
              <EventLog events={state.events} />
            )}

            {activeTab === 'users' && state.currentUser.role === 'admin' && (
                <UserManagement 
                    users={state.users}
                    currentUserId={state.currentUser.id}
                onAdd={(u) => dispatch({ type: 'ADD_USER', payload: u })}
                onUpdate={(u) => dispatch({ type: 'UPDATE_USER', payload: u })}
                onDelete={(id) => dispatch({ type: 'DELETE_USER', payload: id })}
                onLogout={() => dispatch({ type: 'LOGOUT' })}
                    passwordPolicy={state.config.passwordPolicy}
                />
            )}

            {activeTab === 'settings' && state.currentUser.role === 'admin' && (
              <Settings 
                state={state}
                onUpdateConfig={(c) => dispatch({ type: 'UPDATE_CONFIG', payload: c })}
                onImport={(d) => dispatch({ type: 'IMPORT_DATA', payload: d })}
                onLogout={() => dispatch({ type: 'LOGOUT' })}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;