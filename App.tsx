import React, { useEffect, useState } from 'react';
import { View } from 'react-native';

import { RootNavigator } from '@/navigation/RootNavigator';
import { openDatabase } from '@services/db/database';
import { useGarageStore } from '@stores/garageStore';
import { useSettingsStore } from '@stores/settingsStore';

export default function App() {
    const [ready, setReady] = useState(false);

    useEffect(() => {
        const bootstrap = async () => {
            try {
                await openDatabase();
            } catch {
                setReady(false);
                return;
            }
            await useGarageStore.getState().load();
            await useSettingsStore.getState().load();
            setReady(true);
        };
        void bootstrap();
    }, []);

    if (!ready) {
        return <View style={{ flex: 1 }} />;
    }

    return <RootNavigator />;
}
