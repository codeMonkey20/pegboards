import { useCallback, useRef, useState } from 'react';

/**
 * Tracks which async actions (usually HTTP requests) are in flight, so
 * buttons can show a spinner and stay disabled until the request settles.
 * Actions are keyed, so a list can mark just the row that is busy.
 *
 * Starting an action whose key is already running is ignored, which also
 * stops double-clicks and repeated Enter presses from sending duplicates.
 *
 * @returns {{
 *   run: <T>(key: string|number, action: () => Promise<T>) => Promise<T|undefined>,
 *   isBusy: (key: string|number) => boolean,
 *   anyBusy: boolean,
 * }}
 */
export function useBusy() {
    const active = useRef(new Set());
    const [busyKeys, setBusyKeys] = useState(() => new Set());

    const run = useCallback(async (key, action) => {
        if (active.current.has(key)) {
            return undefined;
        }

        active.current.add(key);
        setBusyKeys(new Set(active.current));

        try {
            return await action();
        } finally {
            active.current.delete(key);
            setBusyKeys(new Set(active.current));
        }
    }, []);

    return {
        run,
        isBusy: (key) => busyKeys.has(key),
        anyBusy: busyKeys.size > 0,
    };
}
