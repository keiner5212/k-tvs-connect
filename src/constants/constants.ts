export const APP_NAME = 'K Tvs Connect';

export const STORAGE_KEYS = {
  accessToken: 'k_tvs_connect_access_token',
  refreshToken: 'k_tvs_connect_refresh_token',
  vehicle: 'k_tvs_connect_vehicle',
  themeMode: 'k_tvs_connect_theme_mode',
} as const;

export const HTTP_STATUS = {
  unauthorized: 401,
  forbidden: 403,
  notFound: 404,
  conflict: 409,
  unprocessable: 422,
  tooManyRequests: 429,
} as const;

export const PAGE_SIZE = 20;
