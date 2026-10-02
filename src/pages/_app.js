import { Geist, Geist_Mono } from 'next/font/google';

import RouteProgress from '@/components/layout/RouteProgress';

import '@/styles/globals.css';

const geistSans = Geist({
    variable: '--font-geist-sans',
    subsets: ['latin'],
});

const geistMono = Geist_Mono({
    variable: '--font-geist-mono',
    subsets: ['latin'],
});

/**
 * Application root component.
 *
 * @param {Object} props
 * @param {React.ComponentType} props.Component
 * @param {Object} props.pageProps
 * @returns {JSX.Element}
 */
export default function App({ Component, pageProps }) {
    return (
        <div className={`${geistSans.variable} ${geistMono.variable} font-sans`}>
            <RouteProgress />
            <Component {...pageProps} />
        </div>
    );
}
