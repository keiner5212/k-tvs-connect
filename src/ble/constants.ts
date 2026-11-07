export const BLE_SERVICE_UUIDS = {
    apache: '5456534D-5647-5341-5342-454E544F5251',
    iqube: '5456534D-5647-5341-5342-454E544F5251',
    u388: '5456534d-5647-5555-5342-454e544f5251',
    u546: '5456534d-5647-5555-5342-454e544f5251',
} as const;

export const DEFAULT_SERVICE_UUID = '86307704-0382-9099-5342-454E544F5251';

export const READ_CHARACTERISTIC_UUID = '00005354-0000-1000-8000-00805f9b34fb';
export const WRITE_CHARACTERISTIC_UUID = '00005352-0000-1000-8000-00805f9b34fb';

export const START_BYTE_5A = 0x5a;
export const START_BYTE_5B = 0x5b;

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
export const WRITE_TYPE_WITH_RESPONSE = 2;

export const SCAN_WINDOW_MS = 3000;
export const CONNECT_TIMEOUT_MS = 8000;
export const DATA_TIMEOUT_MS = 5000;
export const RECONNECT_DELAYS_MS = [500, 1000, 2000, 5000, 10000];
