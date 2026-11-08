import { create } from 'zustand';

import { BikeTelemetry, ConnectionState } from '@typings/types';
import { ConnectionInfo, connectionController } from '@ble/connectionController';

interface BleState {
    state: ConnectionState;
    info: ConnectionInfo;
    telemetry: BikeTelemetry | null;
    lastUpdateAt: number | null;
    bind: () => () => void;
}

export const useBleStore = create<BleState>((set) => ({
    state: 'off',
    info: { state: 'off', attempt: 0, nextRetryAt: null, reason: null },
    telemetry: null,
    lastUpdateAt: null,
    bind: () => {
        const unsubscribeState = connectionController.subscribeState((state) => {
            set({ state });
        });
        const unsubscribeInfo = connectionController.subscribeInfo((info) => {
            set({ info });
        });
        const unsubscribeTelemetry = connectionController.subscribeTelemetry((telemetry) => {
            set({ telemetry, lastUpdateAt: telemetry.receivedAt });
        });
        return () => {
            unsubscribeState();
            unsubscribeInfo();
            unsubscribeTelemetry();
        };
    },
}));
