import { DEFAULT_SERVICE_UUID } from './constants';

const SERVICE_UUID_SUFFIX = '9-5342-454E544F5251';

/**
 * The service uuid of the newer bikes is derived from the phone imei:
 * eight digits, four digits, three digits plus a nine, then the vendor suffix.
 */
export const deriveServiceUuidFromImei = (imei: string): string => {
    const digits = imei.trim().toUpperCase().replace(/[^0-9A-Z]/g, '');
    if (digits.length !== 15) {
        return DEFAULT_SERVICE_UUID;
    }
    return `${digits.slice(0, 8)}-${digits.slice(8, 12)}-${digits.slice(12, 15)}${SERVICE_UUID_SUFFIX}`;
};

export const serviceUuidCandidates = (imei: string | null): string[] => {
    const candidates = [DEFAULT_SERVICE_UUID];
    if (imei) {
        candidates.unshift(deriveServiceUuidFromImei(imei));
    }
    return Array.from(new Set(candidates));
};
