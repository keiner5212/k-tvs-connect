import { BikeTelemetry } from '@typings/types';
import { connectionController } from '@ble/connectionController';
import { finishRide, startRide } from '@services/db/rideRepository';
import { getRouteContext, recordObservation } from '@services/db/etaRepository';
import { useMapStore } from '@stores/mapStore';

const MOVING_SPEED_KMH = 3;
const IDLE_TIMEOUT_MS = 30000;

interface ActiveRide {
    id: string;
    contextId: string | null;
    startedAt: number;
    startOdometerKm: number;
    lastOdometerKm: number;
    maxSpeedKmh: number;
    speedSum: number;
    samples: number;
    lastMovingAt: number;
}

class RideTracker {
    private active: ActiveRide | null = null;

    private bikeId: string | null = null;

    start(bikeId: string): void {
        this.bikeId = bikeId;
    }

    stop(): void {
        this.bikeId = null;
        void this.finish();
    }

    onTelemetry(telemetry: BikeTelemetry): void {
        if (!this.bikeId) {
            return;
        }

        const now = telemetry.receivedAt;
        const moving = telemetry.speedKmh > MOVING_SPEED_KMH;

        if (!this.active) {
            if (!moving) {
                return;
            }
            this.active = {
                id: '',
                contextId: useMapStore.getState().routeContext?.id ?? null,
                startedAt: now,
                startOdometerKm: telemetry.odometerKm,
                lastOdometerKm: telemetry.odometerKm,
                maxSpeedKmh: telemetry.speedKmh,
                speedSum: telemetry.speedKmh,
                samples: 1,
                lastMovingAt: now,
            };
            void startRide(this.bikeId).then((ride) => {
                if (this.active) {
                    this.active.id = ride.id;
                }
            });
            return;
        }

        this.active.lastOdometerKm = telemetry.odometerKm;
        this.active.maxSpeedKmh = Math.max(this.active.maxSpeedKmh, telemetry.speedKmh);
        this.active.speedSum += telemetry.speedKmh;
        this.active.samples += 1;

        if (moving) {
            this.active.lastMovingAt = now;
            return;
        }

        if (now - this.active.lastMovingAt > IDLE_TIMEOUT_MS) {
            void this.finish();
        }
    }

    private async finish(): Promise<void> {
        const ride = this.active;
        this.active = null;
        if (!ride || !ride.id) {
            return;
        }

        const distanceMeters = Math.max(
            0,
            (ride.lastOdometerKm - ride.startOdometerKm) * 1000,
        );

        await finishRide(ride.id, {
            distanceMeters,
            maxSpeedKmh: ride.maxSpeedKmh,
            averageSpeedKmh: ride.speedSum / Math.max(1, ride.samples),
        });

        if (ride.contextId) {
            const context = await getRouteContext(ride.contextId);
            if (context) {
                const rawSeconds = ride.lastMovingAt - ride.startedAt;
                const observedSeconds = Math.max(
                    1,
                    rawSeconds - Math.min(30, rawSeconds * 0.1),
                );
                await recordObservation({
                    context,
                    observedSeconds,
                    observedMeters: distanceMeters,
                });
            }
        }
    }
}

export const rideTracker = new RideTracker();

export const bindRideTracker = (): (() => void) => {
    const unsubscribe = connectionController.subscribeTelemetry((telemetry) => {
        rideTracker.onTelemetry(telemetry);
    });
    return unsubscribe;
};
