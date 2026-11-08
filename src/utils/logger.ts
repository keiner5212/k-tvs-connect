export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogFields {
    service?: string;
    event?: string;
    host?: string;
    pathTemplate?: string;
    status?: number;
    durationMs?: number;
    bytes?: number;
    count?: number;
    errorName?: string;
    requestId?: string;
}

export interface LogEntry {
    at: number;
    level: LogLevel;
    message: string;
    fields: LogFields;
}

const ALLOWED_FIELDS: (keyof LogFields)[] = [
    'service',
    'event',
    'host',
    'pathTemplate',
    'status',
    'durationMs',
    'bytes',
    'count',
    'errorName',
    'requestId',
];

const RING_LIMIT = 500;

const ring: LogEntry[] = [];

const pickAllowed = (fields: LogFields): LogFields => {
    const picked: Record<string, unknown> = {};
    for (const key of ALLOWED_FIELDS) {
        const value = fields[key];
        if (value !== undefined) {
            picked[key] = value;
        }
    }
    return picked as LogFields;
};

const formatEntry = (entry: LogEntry): string => {
    const fields = Object.entries(entry.fields)
        .map(([key, value]) => `${key}=${String(value)}`)
        .join(' ');
    const time = new Date(entry.at).toISOString();
    return `${time} ${entry.level.toUpperCase()} ${entry.message}${fields ? ` ${fields}` : ''}`;
};

/**
 * The log of a ride has to survive the app being closed, and it has to be
 * readable from a computer, so the native module keeps it in a file.
 */
const persist = (entry: LogEntry) => {
    void import('@cluster')
        .then(({ getClusterModule }) => {
            const native = getClusterModule();
            return native ? native.appendLog(formatEntry(entry)) : null;
        })
        .catch(() => undefined);
};

const write = (level: LogLevel, message: string, fields: LogFields) => {
    const safeFields = pickAllowed(fields);
    const entry: LogEntry = { at: Date.now(), level, message, fields: safeFields };

    ring.push(entry);
    if (ring.length > RING_LIMIT) {
        ring.shift();
    }

    persist(entry);

    if (!__DEV__) {
        return;
    }

    const target = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    target(`[${level}] ${message}`, safeFields);
};

export const logger = {
    debug: (message: string, fields: LogFields = {}) => write('debug', message, fields),
    info: (message: string, fields: LogFields = {}) => write('info', message, fields),
    warn: (message: string, fields: LogFields = {}) => write('warn', message, fields),
    error: (message: string, fields: LogFields = {}) => write('error', message, fields),
    recent: (): LogEntry[] => [...ring].reverse(),
    clear: () => {
        ring.length = 0;
    },
};
