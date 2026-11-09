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

const write = (level: LogLevel, message: string, fields: LogFields) => {
    const safeFields = pickAllowed(fields);

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
};
