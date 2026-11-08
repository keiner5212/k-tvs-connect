import { logger } from '@utils/logger';

const DEFAULT_TIMEOUT_MS = 10000;
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;

const DENIED_HOST_PATTERNS = [
    /tvsmotor/i,
    /tvsm\.connect/i,
    /servicebus\.windows\.net/i,
    /firebase/i,
    /crashlytics/i,
    /app-measurement/i,
];

const PRIVATE_HOST_PATTERN = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$)/;

const lastRequestAt = new Map<string, number>();

const byteLength = (text: string): number => {
    let bytes = 0;
    for (let index = 0; index < text.length; index += 1) {
        const code = text.charCodeAt(index);
        if (code < 0x80) {
            bytes += 1;
        } else if (code < 0x800) {
            bytes += 2;
        } else if (code >= 0xd800 && code <= 0xdbff) {
            bytes += 4;
            index += 1;
        } else {
            bytes += 3;
        }
    }
    return bytes;
};

const readHeaders = (response: Response): Record<string, string> => {
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
        headers[key.toLowerCase()] = value;
    });
    return headers;
};

const isPrivateHost = (host: string): boolean => PRIVATE_HOST_PATTERN.test(host);

const assertAllowedUrl = (url: URL): void => {
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isPrivateHost(url.hostname))) {
        throw new Error('only https is allowed');
    }
    if (url.username || url.password) {
        throw new Error('credentials in the url are not allowed');
    }
    if (url.hash) {
        throw new Error('fragments are not allowed');
    }
    if (DENIED_HOST_PATTERNS.some((pattern) => pattern.test(url.hostname))) {
        throw new Error('this host is not allowed');
    }
};

const throttle = async (host: string, minIntervalMs: number): Promise<void> => {
    const previous = lastRequestAt.get(host) ?? 0;
    const wait = previous + minIntervalMs - Date.now();
    if (wait > 0) {
        await new Promise((resolve) => setTimeout(resolve, wait));
    }
    lastRequestAt.set(host, Date.now());
};

export interface HttpOptions {
    service: string;
    minIntervalMs?: number;
    timeoutMs?: number;
    maxBytes?: number;
    headers?: Record<string, string>;
}

export class HttpError extends Error {
    readonly status: number;

    constructor(status: number, message: string) {
        super(message);
        this.name = 'HttpError';
        this.status = status;
    }
}

export interface HttpResult<T> {
    status: number;
    body: T;
    requestId: string;
    headers: Record<string, string>;
    notModified: boolean;
}

export const httpGetJson = async <T>(
    url: string,
    options: HttpOptions,
): Promise<HttpResult<T>> => {
    const parsed = new URL(url);
    assertAllowedUrl(parsed);

    await throttle(parsed.hostname, options.minIntervalMs ?? 0);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    const requestId = `${Date.now().toString(36)}`;
    const startedAt = Date.now();

    try {
        const response = await fetch(parsed.toString(), {
            method: 'GET',
            redirect: 'error',
            signal: controller.signal,
            headers: {
                Accept: 'application/json',
                'User-Agent': 'K-Tvs-Connect/0.1 (personal bike companion)',
                'X-Client-Id': 'k-tvs-connect',
                ...options.headers,
            },
        });

        const declared = Number(response.headers.get('content-length') ?? '0');
        if (declared > (options.maxBytes ?? MAX_RESPONSE_BYTES)) {
            throw new Error('response is too large');
        }

        if (response.status === 304) {
            logger.info('http request', {
                service: options.service,
                host: parsed.hostname,
                pathTemplate: parsed.pathname,
                status: response.status,
                durationMs: Date.now() - startedAt,
                requestId,
            });
            return {
                status: 304,
                body: null as T,
                requestId,
                headers: readHeaders(response),
                notModified: true,
            };
        }

        const text = await response.text();
        if (byteLength(text) > (options.maxBytes ?? MAX_RESPONSE_BYTES)) {
            throw new Error('response is too large');
        }

        logger.info('http request', {
            service: options.service,
            host: parsed.hostname,
            pathTemplate: parsed.pathname,
            status: response.status,
            durationMs: Date.now() - startedAt,
            bytes: text.length,
            requestId,
        });

        if (!response.ok) {
            throw new HttpError(response.status, `request failed with status ${response.status}`);
        }

        return {
            status: response.status,
            body: JSON.parse(text) as T,
            requestId,
            headers: readHeaders(response),
            notModified: false,
        };
    } catch (error) {
        logger.error('http request failed', {
            service: options.service,
            host: parsed.hostname,
            pathTemplate: parsed.pathname,
            errorName: error instanceof Error ? error.name : 'UnknownError',
            durationMs: Date.now() - startedAt,
            requestId,
        });
        throw error;
    } finally {
        clearTimeout(timeout);
    }
};

export const httpPostJson = async <T>(
    url: string,
    payload: unknown,
    options: HttpOptions,
): Promise<HttpResult<T>> => {
    const parsed = new URL(url);
    assertAllowedUrl(parsed);

    await throttle(parsed.hostname, options.minIntervalMs ?? 0);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    const requestId = `${Date.now().toString(36)}`;
    const startedAt = Date.now();

    try {
        const response = await fetch(parsed.toString(), {
            method: 'POST',
            redirect: 'error',
            signal: controller.signal,
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                'User-Agent': 'K-Tvs-Connect/0.1 (personal bike companion)',
                'X-Client-Id': 'k-tvs-connect',
                ...options.headers,
            },
            body: JSON.stringify(payload),
        });

        const declared = Number(response.headers.get('content-length') ?? '0');
        if (declared > (options.maxBytes ?? MAX_RESPONSE_BYTES)) {
            throw new Error('response is too large');
        }

        if (response.status === 304) {
            logger.info('http request', {
                service: options.service,
                host: parsed.hostname,
                pathTemplate: parsed.pathname,
                status: response.status,
                durationMs: Date.now() - startedAt,
                requestId,
            });
            return {
                status: 304,
                body: null as T,
                requestId,
                headers: readHeaders(response),
                notModified: true,
            };
        }

        const text = await response.text();
        if (byteLength(text) > (options.maxBytes ?? MAX_RESPONSE_BYTES)) {
            throw new Error('response is too large');
        }

        logger.info('http request', {
            service: options.service,
            host: parsed.hostname,
            pathTemplate: parsed.pathname,
            status: response.status,
            durationMs: Date.now() - startedAt,
            bytes: text.length,
            requestId,
        });

        if (!response.ok) {
            throw new HttpError(response.status, `request failed with status ${response.status}`);
        }

        return {
            status: response.status,
            body: JSON.parse(text) as T,
            requestId,
            headers: readHeaders(response),
            notModified: false,
        };
    } catch (error) {
        logger.error('http request failed', {
            service: options.service,
            host: parsed.hostname,
            pathTemplate: parsed.pathname,
            errorName: error instanceof Error ? error.name : 'UnknownError',
            durationMs: Date.now() - startedAt,
            requestId,
        });
        throw error;
    } finally {
        clearTimeout(timeout);
    }
};

export const isAllowedBaseUrl = (value: string): boolean => {
    try {
        assertAllowedUrl(new URL(value));
        return true;
    } catch {
        return false;
    }
};
