import { create } from 'zustand';

import { Bike, BikeInput } from '@typings/types';
import {
    deleteBike,
    insertBike,
    listBikes,
    setActiveBike,
    updateBike,
} from '@services/db/bikeRepository';
import { describeError, logger } from '@utils/logger';

interface GarageState {
    bikes: Bike[];
    loading: boolean;
    load: () => Promise<void>;
    add: (input: BikeInput) => Promise<Bike>;
    edit: (id: string, input: BikeInput) => Promise<void>;
    remove: (id: string) => Promise<void>;
    activate: (id: string) => Promise<void>;
    activeBike: () => Bike | null;
}

export const useGarageStore = create<GarageState>((set, get) => ({
    bikes: [],
    loading: false,
    load: async () => {
        set({ loading: true });
        try {
            const bikes = await listBikes();
            set({ bikes, loading: false });
        } catch (error) {
            logger.warn(`the garage could not be read: ${describeError(error)}`, {
                service: 'db',
                event: 'garage_load_failed',
                errorName: error instanceof Error ? error.name : 'UnknownError',
            });
            set({ loading: false });
        }
    },
    add: async (input) => {
        const bike = await insertBike(input);
        await get().load();
        if (!get().bikes.some((candidate) => candidate.isActive)) {
            await get().activate(bike.id);
        }
        return bike;
    },
    edit: async (id, input) => {
        await updateBike(id, input);
        await get().load();
    },
    remove: async (id) => {
        await deleteBike(id);
        await get().load();
    },
    activate: async (id) => {
        await setActiveBike(id);
        await get().load();
    },
    activeBike: () => get().bikes.find((bike) => bike.isActive) ?? null,
}));
