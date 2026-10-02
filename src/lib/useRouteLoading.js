import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

/**
 * The URL being navigated to while `getServerSideProps` for the next page
 * is running, or null when no navigation is in progress.
 *
 * @returns {string|null}
 */
export function useRouteLoading() {
    const router = useRouter();
    const [target, setTarget] = useState(null);

    useEffect(() => {
        const start = (url, { shallow }) => {
            if (!shallow) {
                setTarget(url);
            }
        };
        const done = () => setTarget(null);

        router.events.on('routeChangeStart', start);
        router.events.on('routeChangeComplete', done);
        router.events.on('routeChangeError', done);

        return () => {
            router.events.off('routeChangeStart', start);
            router.events.off('routeChangeComplete', done);
            router.events.off('routeChangeError', done);
        };
    }, [router.events]);

    return target;
}

/**
 * Strips the query string and hash from a URL.
 *
 * @param {string} url
 * @returns {string}
 */
export function pathOf(url) {
    return url.split(/[?#]/)[0];
}
