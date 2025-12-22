import express from 'express';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import crypto from 'crypto';
import fetch from 'node-fetch';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize SQLite DB
const dbPromise = open({
  filename: path.join(DATA_DIR, 'pbxr.db'),
  driver: sqlite3.Database
});

const app = express();
app.use(express.json({ limit: '50mb' }));

// Serve static frontend files from 'dist' (created by build step)
app.use(express.static(path.join(__dirname, 'dist')));

// Initialize DB schema
(async () => {
  const db = await dbPromise;
  await db.exec(`
    CREATE TABLE IF NOT EXISTS kv_store (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);
  console.log('Database initialized at data/pbxr.db');
  // If no app_state is present, seed DB with INITIAL_STATE (from constants). We dynamically import
  // the constants so the server can run even if TypeScript sources are present.
  try {
    const existing = await db.get('SELECT value FROM kv_store WHERE key = ?', 'app_state');
    if (!existing) {
      let seed;
      try {
        const mod = await import('./constants.js');
        seed = JSON.parse(JSON.stringify(mod.INITIAL_STATE || {}));
      } catch (e) {
        // Fallback minimal seed if constants not importable
        seed = {
          users: [ { id: 'u1', username: 'admin', password: 'password123', role: 'admin', sessions: [] } ],
          probers: [],
          targets: [],
          targetGroups: [],
          config: {},
          events: [ { id: 'init', type: 'info', message: 'System initialized', timestamp: new Date().toISOString(), user: 'system' } ]
        };
      }
      // Hash plaintext passwords in seed
      if (Array.isArray(seed.users)) {
        seed.users = seed.users.map(u => {
          if (u && typeof u.password === 'string' && !u.password.startsWith('scrypt$')) {
            const salt = crypto.randomBytes(16).toString('hex');
            const derived = crypto.scryptSync(u.password, salt, 64).toString('hex');
            return { ...u, password: `scrypt$${salt}$${derived}` };
          }
          return u;
        });
      }
      // Persist seed state and events
      const stateJson = JSON.stringify(seed);
      await db.run('INSERT INTO kv_store (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', 'app_state', stateJson);
      const events = Array.isArray(seed.events) ? seed.events : [];
      await db.run('INSERT INTO kv_store (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', 'app_events', JSON.stringify(events));
      console.log('Seeded database with INITIAL_STATE');
    }
  } catch (e) {
    console.error('Failed to seed INITIAL_STATE on startup', e);
  }
  // On server start, clear any active sessions to force clients to re-authenticate.
  try {
    const row = await db.get('SELECT value FROM kv_store WHERE key = ?', 'app_state');
    if (row && row.value) {
      const state = JSON.parse(row.value);
      if (Array.isArray(state.users)) {
        state.users = state.users.map(u => ({ ...u, sessions: [] }));
        // add startup event
        const evRow = await db.get('SELECT value FROM kv_store WHERE key = ?', 'app_events');
        let events = [];
        try { if (evRow && evRow.value) events = JSON.parse(evRow.value); } catch (e) { events = []; }
        const bootEvent = { id: crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex'), message: 'Server restarted - sessions cleared', type: 'warning', timestamp: new Date().toISOString(), user: 'system' };
        events.unshift(bootEvent);
        await db.run('INSERT INTO kv_store (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', 'app_events', JSON.stringify(events));
        await db.run('INSERT INTO kv_store (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', 'app_state', JSON.stringify(state));
        console.log('Cleared user sessions on startup and recorded boot event');
      }
    }
  } catch (e) {
    console.error('Failed to clear sessions on startup', e);
  }
})();

// API: Get entire application state
app.get('/api/state', async (req, res) => {
  try {
    const db = await dbPromise;
    const result = await db.get('SELECT value FROM kv_store WHERE key = ?', 'app_state');
    if (result) {
      res.json(JSON.parse(result.value));
    } else {
      res.json(null); // Return null so frontend uses initial state
    }
  } catch (error) {
    console.error('Error fetching state:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// API: Save entire application state
app.post('/api/state', async (req, res) => {
  try {
    const db = await dbPromise;

    // Merge incoming events with persisted events first so we never lose historical events
    // Safety: Prevent accidental DB repopulation when a freshly-deleted DB is present.
    // If there are no persisted events and the incoming payload contains data (users/targets/etc),
    // require an explicit `allowRepopulate: true` flag in the POST body to proceed.
    const evRowCheck = await db.get('SELECT value FROM kv_store WHERE key = ?', 'app_events');
    let existingEventsCheck = [];
    try { if (evRowCheck && evRowCheck.value) existingEventsCheck = JSON.parse(evRowCheck.value); } catch (e) { existingEventsCheck = []; }
    const incomingLooksNonEmpty = (req.body && (Array.isArray(req.body.users) && req.body.users.length > 0) || (Array.isArray(req.body.targets) && req.body.targets.length > 0) || (req.body.config && Object.keys(req.body.config).length > 0));
    if ((existingEventsCheck.length === 0) && incomingLooksNonEmpty && !req.body.allowRepopulate) {
      return res.status(412).json({ error: 'Repopulation blocked: set allowRepopulate=true to confirm intentional DB repopulation.' });
    }

    // Merge incoming events with persisted events first so we never lose historical events
    // when a client posts state lacking older events.
    let merged = [];
    try {
      const incoming = Array.isArray(req.body.events) ? req.body.events : [];
      const row = await db.get('SELECT value FROM kv_store WHERE key = ?', 'app_events');
      let existing = [];
      try { if (row && row.value) existing = JSON.parse(row.value); } catch (e) { existing = []; }

      const map = new Map();
      // Add incoming first (assume newer), keyed by id when present, otherwise by message+timestamp
      (incoming || []).forEach(ev => {
        if (!ev) return;
        if (ev.id) map.set(ev.id, ev);
        else map.set(`${ev.message || ''}__${ev.timestamp || ''}`, ev);
      });
      // Add existing if not already present
      (existing || []).forEach(ev => {
        if (!ev) return;
        if (ev.id) {
          if (!map.has(ev.id)) map.set(ev.id, ev);
        } else {
          const key = `${ev.message || ''}__${ev.timestamp || ''}`;
          if (!map.has(key)) map.set(key, ev);
        }
      });

      merged = Array.from(map.values()).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch (e) {
      console.error('Failed to merge events for persistence:', e);
      merged = Array.isArray(req.body.events) ? req.body.events : [];
    }

    // Ensure the app_state we're about to persist contains the merged events array
    const stateToSave = { ...req.body, events: merged };

    // Hash any plaintext passwords before persisting into the DB. Stored format: scrypt$<saltHex>$<hashHex>
    try {
      if (Array.isArray(stateToSave.users)) {
        stateToSave.users = stateToSave.users.map(u => {
          if (u && typeof u.password === 'string' && !u.password.startsWith('scrypt$')) {
            const salt = crypto.randomBytes(16).toString('hex');
            const derived = crypto.scryptSync(u.password, salt, 64).toString('hex');
            return { ...u, password: `scrypt$${salt}$${derived}` };
          }
          return u;
        });
      }
    } catch (e) {
      console.error('Failed to hash passwords before persist:', e);
    }
    const stateJson = JSON.stringify(stateToSave);
    await db.run(
      'INSERT INTO kv_store (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      'app_state',
      stateJson
    );

    // Persist merged events to separate `app_events` key as well
    try {
      const eventsJson = JSON.stringify(merged);
      await db.run(
        'INSERT INTO kv_store (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        'app_events',
        eventsJson
      );
    } catch (e) {
      console.error('Failed to persist events separately:', e);
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving state:', error);
    res.status(500).json({ error: 'Database error' });
  }
});


// API: login - authenticate user and create a server-side session
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'Missing credentials' });
    const db = await dbPromise;
    const row = await db.get('SELECT value FROM kv_store WHERE key = ?', 'app_state');
    if (!row) return res.status(404).json({ error: 'App state not found' });
    const state = JSON.parse(row.value);
    const user = (state.users || []).find(u => u.username === username);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const stored = user.password || '';
    let ok = false;
    try {
      if (stored.startsWith('scrypt$')) {
        const parts = stored.split('$');
        const salt = parts[1];
        const hash = parts[2];
        const derived = crypto.scryptSync(password, salt, 64).toString('hex');
        ok = crypto.timingSafeEqual(Buffer.from(derived, 'hex'), Buffer.from(hash, 'hex'));
      } else {
        // legacy plaintext entry - compare and upgrade
        ok = stored === password;
        if (ok) {
          // upgrade to hashed form
          const salt = crypto.randomBytes(16).toString('hex');
          const derived = crypto.scryptSync(password, salt, 64).toString('hex');
          user.password = `scrypt$${salt}$${derived}`;
        }
      }
    } catch (e) {
      console.error('Password verification error', e);
      return res.status(500).json({ error: 'Authentication error' });
    }

    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    // create a server-side session entry
    const forwarded = req.get('x-forwarded-for');
    let ip = forwarded ? forwarded.split(',')[0].trim() : (req.ip || req.socket.remoteAddress || null);
    if (typeof ip === 'string' && ip.startsWith('::ffff:')) ip = ip.replace('::ffff:', '');
    const userAgent = req.get('user-agent') || '';
    const sessionId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
    const sess = { id: sessionId, ip, userAgent, lastActive: new Date().toISOString() };
    user.sessions = Array.isArray(user.sessions) ? [...user.sessions, sess] : [sess];

    // create login event and persist
    const event = { id: crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex'), message: `${user.username} logged in`, type: 'info', timestamp: new Date().toISOString(), user: user.username, meta: { ip, userAgent } };
    // merge with existing events
    try {
      const evRow = await db.get('SELECT value FROM kv_store WHERE key = ?', 'app_events');
      let existing = [];
      try { if (evRow && evRow.value) existing = JSON.parse(evRow.value); } catch (e) { existing = []; }
      const mergedEvents = [event, ...(existing || [])];
      await db.run('INSERT INTO kv_store (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', 'app_events', JSON.stringify(mergedEvents));
    } catch (e) {
      console.error('Failed to persist login event', e);
    }

    // persist updated app_state
    try {
      await db.run('INSERT INTO kv_store (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', 'app_state', JSON.stringify(state));
    } catch (e) {
      console.error('Failed to persist app_state after login', e);
    }

    const safeUser = { ...user };
    delete safeUser.password;
    res.json({ user: safeUser, sessionId });
  } catch (err) {
    console.error('Error during login:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Helper for constant-time comparison to prevent timing attacks on tokens
const secureCompare = (a, b) => {
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

// Shared handler for /targets and /api/targets
const targetsHandler = async (req, res) => {
    try {
        const db = await dbPromise;
        const result = await db.get('SELECT value FROM kv_store WHERE key = ?', 'app_state');
        if (!result) {
            return res.status(404).json({ error: 'App state not found' });
        }

        const state = JSON.parse(result.value);
        const endpointConfig = state.config.targetsEndpoint;

        if (!endpointConfig || !endpointConfig.enabled) {
            return res.status(404).send('404: Endpoint Disabled');
        }

        if (endpointConfig.authRequired) {
            const token = req.query.token;
            if (!secureCompare(token || '', endpointConfig.authToken || '')) {
                return res.status(401).send('401: Unauthorized');
            }
        }

        const discoveryData = [];
        state.targets.forEach(t => {
            t.proberIds.forEach(pid => {
                const prober = state.probers.find(p => p.id === pid);
                if (prober) {
                    const labels = {
                        module: t.module,
                        short_name: t.name,
                        zone: prober.region || 'int',
                        probe_server: prober.name,
                        enabled: String(t.enabled !== false)
                    };
                    if (t.labels && t.labels.length > 0) {
                        t.labels.forEach(l => {
                            labels[l.key] = l.value;
                        });
                    }
                    discoveryData.push({
                        targets: [t.url],
                        labels: labels
                    });
                }
            });
        });

        res.json(discoveryData);
    } catch (error) {
        console.error('Error fetching targets:', error);
        res.status(500).json({ error: 'Database error' });
    }
};

// Shared handler for /prometheus and /api/prometheus
const prometheusHandler = async (req, res) => {
    try {
        const db = await dbPromise;
        const result = await db.get('SELECT value FROM kv_store WHERE key = ?', 'app_state');
        if (!result) {
            return res.status(404).send('404: App state not found');
        }

        const state = JSON.parse(result.value);
        const endpointConfig = state.config.prometheusEndpoint;

        if (!endpointConfig || !endpointConfig.enabled) {
            return res.status(404).send('404: Endpoint Disabled');
        }

        const proberId = req.params.prober_id;

        if (endpointConfig.authRequired) {
            const providedToken = req.query.token;
            let requiredToken = endpointConfig.authToken;

            if (proberId && endpointConfig.proberSpecificTokens && endpointConfig.proberSpecificTokens[proberId]) {
                requiredToken = endpointConfig.proberSpecificTokens[proberId];
            }

            if (!secureCompare(providedToken || '', requiredToken || '')) {
                return res.status(401).send('401: Unauthorized');
            }
        }

        let targetProbers = state.probers;
        if (proberId) {
            const specificProber = state.probers.find(p => p.id === proberId);
            if (!specificProber) {
                return res.status(404).send('404: Prober Not Found');
            }
            targetProbers = [specificProber];
        }

        const origin = req.get('origin') || `${req.protocol}://${req.get('host')}`;
        const template = state.config.prometheusTemplate || '';
        const discoveryUrl = origin + '/api/targets' + (state.config.targetsEndpoint.authRequired ? `?token=${state.config.targetsEndpoint.authToken}` : '');
        const httpSdBlock = `    http_sd_configs:
      - url: '${discoveryUrl}'
        refresh_interval: ${state.config.scrapeInterval || '60s'}`;

        const generatedConfigs = targetProbers.map(p => {
            let config = template;
            config = config.replace(/\${job_name}/g, `blackbox-${p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`);
            config = config.replace(/\${prober_name}/g, p.name);
            config = config.replace(/\${prober_url}/g, p.url);
            config = config.replace(/\${scrape_interval}/g, p.scrapeInterval || state.config.scrapeInterval || '60s');
            config = config.replace(/\${discovery_url}/g, discoveryUrl);
            config = config.replace(/\${http_sd_config}/g, httpSdBlock);
            return config;
        }).join('\n');

        const fullYaml = `scrape_configs:\n${generatedConfigs}`;

        res.type('text/yaml').send(fullYaml);
    } catch (error) {
        console.error('Error generating prometheus config:', error);
        res.status(500).send('500: Server error');
    }
};

// API Endpoints
app.get('/api/targets', targetsHandler);
app.get('/targets', targetsHandler);
app.get('/api/prometheus/:prober_id?', prometheusHandler);
app.get('/prometheus/:prober_id?', prometheusHandler);

// API: return client info (IP, user-agent) to allow client to record session metadata
app.get('/api/client-info', (req, res) => {
  try {
    // Prefer X-Forwarded-For if behind a proxy
    const forwarded = req.get('x-forwarded-for');
    let ip = forwarded ? forwarded.split(',')[0].trim() : (req.ip || req.socket.remoteAddress || null);
    // Normalize IPv4-mapped IPv6 addresses e.g. ::ffff:192.168.0.1
    if (typeof ip === 'string' && ip.startsWith('::ffff:')) {
      ip = ip.replace('::ffff:', '');
    }
    const userAgent = req.get('user-agent') || '';
    res.json({ ip, userAgent });
  } catch (err) {
    console.error('Error fetching client info:', err);
    res.status(500).json({ error: 'Failed to determine client info' });
  }
});

// API: return persisted events (separate log store)
app.get('/api/events', async (req, res) => {
  try {
    const db = await dbPromise;
    const row = await db.get('SELECT value FROM kv_store WHERE key = ?', 'app_events');
    if (!row) return res.json([]);
    return res.json(JSON.parse(row.value));
  } catch (err) {
    console.error('Error fetching events:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// API: revoke sessions for a user (all sessions or a specific session index)
app.post('/api/users/:id/sessions/revoke', async (req, res) => {
  try {
    const userId = req.params.id;
    const { sessionIndex, actorId } = req.body || {};
    const db = await dbPromise;
    const row = await db.get('SELECT value FROM kv_store WHERE key = ?', 'app_state');
    if (!row) return res.status(404).json({ error: 'App state not found' });
    const state = JSON.parse(row.value);
    const user = (state.users || []).find(u => u.id === userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (typeof sessionIndex === 'number') {
      // remove a specific session index if present
      user.sessions = (user.sessions || []).filter((s, idx) => idx !== sessionIndex);
        } else if (req.body.sessionId) {
          // remove by session id when provided
          const sessionId = req.body.sessionId;
          user.sessions = (user.sessions || []).filter(s => !(s && s.id === sessionId));
        } else if (req.body.fingerprint) {
          // fingerprint can be an object { ip, userAgent, lastActive }
          const f = req.body.fingerprint;
          user.sessions = (user.sessions || []).filter(s => !(s && s.ip === f.ip && s.userAgent === f.userAgent && s.lastActive === f.lastActive));
    } else {
      // remove all sessions
      user.sessions = [];
    }

    // add an audit event
    const actor = (state.users || []).find(u => u.id === actorId);
    const actorName = actor ? actor.username : 'system';
    const event = {
      id: crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex'),
      message: `${actorName} revoked sessions for user ${user.username}`,
      type: 'warning',
      timestamp: new Date().toISOString(),
      user: actorName
    };

    // merge into app_events
    try {
      const evRow = await db.get('SELECT value FROM kv_store WHERE key = ?', 'app_events');
      let existing = [];
      try { if (evRow && evRow.value) existing = JSON.parse(evRow.value); } catch (e) { existing = []; }
      const merged = [event, ...(existing || [])];
      await db.run('INSERT INTO kv_store (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', 'app_events', JSON.stringify(merged));
    } catch (e) {
      console.error('Failed to persist session revoke event', e);
    }

    // persist updated app_state
    await db.run('INSERT INTO kv_store (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', 'app_state', JSON.stringify(state));

    res.json({ success: true });
  } catch (err) {
    console.error('Error revoking sessions:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// API: verify a user's current password
app.post('/api/users/:id/verify-password', async (req, res) => {
  try {
    const userId = req.params.id;
    const { password } = req.body || {};
    if (!password) return res.status(400).json({ error: 'Missing password' });

    const db = await dbPromise;
    const row = await db.get('SELECT value FROM kv_store WHERE key = ?', 'app_state');
    if (!row) return res.status(404).json({ error: 'App state not found' });
    const state = JSON.parse(row.value);
    const user = (state.users || []).find(u => u.id === userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const stored = user.password || '';
    let ok = false;
    try {
      if (stored.startsWith('scrypt$')) {
        const parts = stored.split('$');
        const salt = parts[1];
        const hash = parts[2];
        const derived = crypto.scryptSync(password, salt, 64).toString('hex');
        ok = crypto.timingSafeEqual(Buffer.from(derived, 'hex'), Buffer.from(hash, 'hex'));
      } else {
        // legacy plaintext
        ok = stored === password;
      }
    } catch (e) {
      console.error('Password verification error', e);
      return res.status(500).json({ error: 'Verification error' });
    }

    res.json({ success: ok });
  } catch (err) {
    console.error('Error during password verification:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// API: Proxy Prometheus reload POST request
app.post('/api/prometheus/reload', async (req, res) => {
    try {
        const db = await dbPromise;
        const result = await db.get('SELECT value FROM kv_store WHERE key = ?', 'app_state');
        if (!result) {
            return res.status(404).json({ error: 'App state not found' });
        }
        const state = JSON.parse(result.value);
        const promConfig = state.config || {};
        const promUrl = promConfig.prometheusUrl;
        if (!promUrl) {
            return res.status(400).json({ error: 'Prometheus URL not configured' });
        }

        const base = promUrl.replace(/\/$/, '');
        const reloadUrl = `${base}/-/reload`;

        const headers = {};
        if (promConfig.promAuthMethod === 'basic' && promConfig.promAuthCredentials) {
            headers['Authorization'] = 'Basic ' + Buffer.from(promConfig.promAuthCredentials).toString('base64');
        } else if (promConfig.promAuthMethod === 'bearer' && promConfig.promAuthCredentials) {
            headers['Authorization'] = 'Bearer ' + promConfig.promAuthCredentials;
        }

        const promRes = await fetch(reloadUrl, { method: 'POST', headers });

        if (promRes.ok) {
            res.status(200).json({ success: true });
        } else {
            res.status(promRes.status).json({ error: `Prometheus reload failed with status ${promRes.status}` });
        }
    } catch (error) {
        console.error('Error proxying Prometheus reload:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Fallback to index.html for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

