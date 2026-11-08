export type UnitSystem = 'metric' | 'imperial';

export const speedUnit = (unit: UnitSystem): string => (unit === 'imperial' ? 'mph' : 'km/h');

export const formatDistance = (meters: number, unit: UnitSystem): string => {
    if (unit === 'imperial') {
        const feet = meters * 3.28084;
        if (feet < 1000) {
            return `${Math.round(feet)} ft`;
        }
        return `${(feet / 5280).toFixed(1)} mi`;
    }
    if (meters < 1000) {
        return `${Math.round(meters)} m`;
    }
    return `${(meters / 1000).toFixed(1)} km`;
};

export const formatDuration = (seconds: number): string => {
    const total = Math.max(0, Math.round(seconds));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    if (hours > 0) {
        return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
    }
    return `${minutes}m`;
};

export const formatClockTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
};

export const formatAge = (timestamp: number | null, now = Date.now()): string => {
    if (timestamp === null) {
        return 'never';
    }
    const seconds = Math.max(0, Math.round((now - timestamp) / 1000));
    if (seconds < 5) {
        return 'just now';
    }
    if (seconds < 60) {
        return `${seconds} s ago`;
    }
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) {
        return `${minutes} min ago`;
    }
    const hours = Math.round(minutes / 60);
    return `${hours} h ago`;
};

export const isStale = (timestamp: number | null, now = Date.now(), limitMs = 60000): boolean =>
    timestamp === null || now - timestamp > limitMs;
