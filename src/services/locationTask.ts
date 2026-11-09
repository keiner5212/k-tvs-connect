import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { LOCATION_TASK_NAME } from '@constants/constants';
import { useLocationStore } from '@stores/locationStore';

/**
 * The route has to keep counting with the screen off, so the phone watches the
 * position in a foreground service. The task has to exist for the service to
 * start, and it is the one that keeps the position of the store fresh.
 */
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
    if (error || !data) {
        return;
    }

    const payload = data as { location?: Location.LocationObject } & Location.LocationObject;
    const location = payload.location ?? payload;
    if (!location?.coords) {
        return;
    }

    useLocationStore.setState({
        lastFixAt: Date.now(),
        position: [location.coords.latitude, location.coords.longitude],
    });
});
