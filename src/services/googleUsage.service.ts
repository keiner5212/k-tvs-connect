import { GOOGLE_CAP_SHARE, GOOGLE_FREE_MONTHLY, GoogleSku, googleMonthKey } from '@config/quota';
import { getSetting, setSetting } from '@services/db/settingsRepository';

const counterKey = (sku: GoogleSku): string => `googleUsage:${sku}:${googleMonthKey()}`;

/** how many billable events this sku already had this month */
export const googleUsage = async (sku: GoogleSku): Promise<number> => {
    const raw = await getSetting(counterKey(sku));
    const value = raw ? Number(raw) : 0;
    return Number.isFinite(value) ? value : 0;
};

export const chargeGoogleUsage = async (sku: GoogleSku, events = 1): Promise<number> => {
    const next = (await googleUsage(sku)) + events;
    await setSetting(counterKey(sku), String(next));
    return next;
};

/** the free cap is the limit, the app stops a little before it */
export const googleQuotaLeft = async (sku: GoogleSku): Promise<number> => {
    const used = await googleUsage(sku);
    return Math.max(0, GOOGLE_FREE_MONTHLY[sku] * GOOGLE_CAP_SHARE - used);
};

export const canUseGoogle = async (sku: GoogleSku): Promise<boolean> =>
    (await googleQuotaLeft(sku)) > 0;
