import { useEffect, useState } from 'react';

export const useNow = (intervalMs = 1000): number => {
    const [now, setNow] = useState(0);

    useEffect(() => {
        const tick = () => setNow(Date.now());
        tick();
        const timer = setInterval(tick, intervalMs);
        return () => clearInterval(timer);
    }, [intervalMs]);

    return now;
};
