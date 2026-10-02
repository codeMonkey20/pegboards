import { useEffect, useState } from 'react';

import { useRouteLoading } from '@/lib/useRouteLoading';

// Fast navigations finish before this, so the bar doesn't flicker.
const SHOW_AFTER_MS = 150;

/**
 * Thin indeterminate bar along the top of the window while the next page
 * loads (including refreshes of the current page's data).
 *
 * @returns {JSX.Element|null}
 */
export default function RouteProgress() {
    const target = useRouteLoading();
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (!target) {
            return undefined;
        }

        const timer = setTimeout(() => setVisible(true), SHOW_AFTER_MS);

        return () => {
            clearTimeout(timer);
            setVisible(false);
        };
    }, [target]);

    if (!visible) {
        return null;
    }

    return (
        <div role="progressbar" aria-label="Loading page" className="fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden bg-violet-200 dark:bg-violet-950">
            <div className="h-full w-1/3 bg-violet-600 motion-safe:animate-route-progress motion-reduce:w-full dark:bg-violet-400" />
        </div>
    );
}
