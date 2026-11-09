export type UnitSystem = 'metric' | 'imperial';

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
    const rest = (total % 60).toString().padStart(2, '0');
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${rest}`;
    }
    return `${minutes}:${rest}`;
};

const MONTHS = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
];

const startOfDay = (date: Date): number =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

/** when a ride happened, in words the rider reads fast */
export const formatDay = (timestamp: number): string => {
    const date = new Date(timestamp);
    const days = Math.floor((startOfDay(new Date()) - startOfDay(date)) / 86400000);

    if (days <= 0) {
        return 'Today';
    }
    if (days === 1) {
        return 'Yesterday';
    }
    if (days < 7) {
        return `${days} days ago`;
    }
    return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
};

export const formatClockTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
};
