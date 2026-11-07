import { create } from 'zustand';

import { BikeTelemetry, ConnectionState } from '@typings/types';
import { connectionController } from '@ble/connectionController';

interface BleState {
    state: ConnectionState;
    telemetry: BikeTelemetry | null;
    lastUpdateAt: number | null;
    bind: () => () => void;
}

export const useBleStore = create<BleState>((set) => ({
    state: 'off',
    telemetry: null,
    lastUpdateAt: null,
    bind: () => {
        const unsubscribeState = connectionController.subscribeState((state) => {
            set({ state });
        });
        const unsubscribeTelemetry = connectionController.subscribeTelemetry((telemetry) => {
            set({ telemetry, lastUpdateAt: telemetry.receivedAt });
        });
        return () => {
            unsubscribeState();
            unsubscribeTelemetry();
        };
    },
}));
