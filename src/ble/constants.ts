export const READ_CHARACTERISTIC_UUID = '00005354-0000-1000-8000-00805f9b34fb';
export const WRITE_CHARACTERISTIC_UUID = '00005352-0000-1000-8000-00805f9b34fb';

/**
 * The service of the cluster, the same one the original app looks for after
 * the discovery. A device that announces it is worth a try.
 */
export const BIKE_SERVICE_UUID = '5456534D-5647-5341-5342-454E544F5251';

/**
 * The cluster of the older generation answers on its own service, whose uuid
 * starts with this. The app finds it in the discovery.
 */
export const CLUSTER_SERVICE_MARK = '5500';

/** the same uuid without the dashes, to compare it with any spelling */
export const bikeServiceKey = (uuid: string): string => uuid.replace(/-/g, '').toUpperCase();

export const START_BYTE_5A = 0x5a;
export const START_BYTE_9B = 0x9b;

export const DATA_ID = {
    speedometer5A10: 16,
    speedometer5A11: 17,
    speedometer5A12: 18,
    speedometer5A16: 22,
    speedometer5A18: 24,
    wifiPassword5A29: 41,
    tripData: 25,
    musicControl: 107,
} as const;

export const BLE_MTU = 512;
export const SCAN_WINDOW_MS = 5000;
/**
 * The original app waits 35 seconds for the cluster before it gives the link
 * up. A bike that is just switched on needs that time to answer.
 */
export const CONNECT_TIMEOUT_MS = 35000;
/**
 * The direct connect to the address the app already knows. It is the fast
 * path of a reconnection, the scan is the fallback.
 */
export const DIRECT_CONNECT_TIMEOUT_MS = 10000;
export const DATA_TIMEOUT_MS = 5000;
/**
 * A cluster that answers the gatt connect but never sends a frame is not a
 * bike, or a bike that is not switched on. The link is given up after
 * this, so the app stops saying it is connected.
 */
export const FIRST_FRAME_TIMEOUT_MS = 10000;

/** the backoff of the reconnection, the last one repeats forever */
export const RECONNECT_DELAYS_MS = [1000, 2000, 4000, 8000, 15000, 30000];
