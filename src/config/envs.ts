export const envs = {
  apiBaseUrl: 'https://api.tvsm.connect',
  appVersion: '0.1.0',
  requestTimeoutMs: 15000,
} as const;

export type Envs = typeof envs;
