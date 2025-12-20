

import { AppState, User, Prober, Target, TargetGroup } from './types';

export const INITIAL_USERS: User[] = [
  { 
    id: 'u1', 
    username: 'admin', 
    password: 'password123', 
    role: 'admin',
    sessions: [
      { ip: '192.168.1.5', userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', lastActive: new Date().toISOString() }
    ]
  },
  {
    id: 'u2',
    username: 'viewer',
    password: 'password123',
    role: 'viewer',
    sessions: [
        { ip: '10.0.0.42', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', lastActive: new Date(Date.now() - 3600000).toISOString() }
    ]
  },
];

export const INITIAL_PROBERS: Prober[] = [
  { id: 'p1', name: 'US East', url: '192.168.1.100:9115', modules: ['http_2xx', 'icmp'] },
  { id: 'p2', name: 'EU West', url: '192.168.1.101:9115', modules: ['http_2xx', 'dns_tcp', 'tcp_connect'] },
];

export const INITIAL_GROUPS: TargetGroup[] = [
  { id: 'g1', name: 'Production', description: 'Critical customer facing services', color: '#3b82f6' },
  { id: 'g2', name: 'Internal Services', description: 'Back office and dev tools', color: '#a855f7' },
];

export const INITIAL_TARGETS: Target[] = [
  {
    id: 't1',
    name: 'Google Production',
    url: 'https://google.com',
    proberIds: ['p1', 'p2'],
    labels: [{key: 'env', value: 'prod'}, {key: 'team', value: 'sre'}],
    module: 'http_2xx',
    status: 'up',
    enabled: true,
    groupId: 'g1'
  },
  {
    id: 't2',
    name: 'Internal API',
    url: 'https://api.internal',
    proberIds: ['p1'],
    labels: [{key: 'env', value: 'dev'}],
    module: 'http_2xx',
    status: 'down',
    enabled: true,
    groupId: 'g2'
  },
];

const DEFAULT_PROM_TEMPLATE = `  - job_name: '${"${job_name}"}'
    scrape_interval: ${"${scrape_interval}"}
    scrape_timeout: 15s
    metrics_path: /probe
    scheme: http
    ${"${http_sd_config}"}
    relabel_configs:
      - source_labels: [probe_server]
        regex: ^${"${prober_name}"}$
        action: keep
      - source_labels: [enabled]
        regex: "false"
        action: drop
      - source_labels: [__address__]
        target_label: __param_target
      - source_labels: [module]
        target_label: __param_module
      - source_labels: [__param_target]
        target_label: instance
      - target_label: probe_ip
        replacement: ${"${prober_url}"}
      - target_label: __address__
        replacement: ${"${prober_url}"}`;

export const INITIAL_STATE: AppState = {
  users: INITIAL_USERS,
  currentUser: null,
  probers: INITIAL_PROBERS,
  targets: INITIAL_TARGETS,
  targetGroups: INITIAL_GROUPS,
  config: {
    prometheusUrl: 'http://prometheus:9090',
    scrapeInterval: '60s',
    promAuthMethod: 'none',
    passwordPolicy: {
        minLength: 8,
        requireNumber: true,
        requireSpecialChar: false
    },
    logRetentionDays: 30,
    autoLogoutMinutes: 0,
    targetsEndpoint: {
        enabled: true,
        authRequired: false,
        authToken: ''
    },
    prometheusEndpoint: {
        enabled: true,
        authRequired: false,
        authToken: '',
        proberSpecificTokens: {}
    },
    prometheusTemplate: DEFAULT_PROM_TEMPLATE
  },
  events: [
    {
      id: 'init',
      type: 'info',
      message: 'System monitoring initialized',
      timestamp: new Date().toISOString(),
      user: 'system'
    }
  ]
};