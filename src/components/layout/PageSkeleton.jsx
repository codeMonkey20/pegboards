import Skeleton from '@/components/ui/Skeleton';

const CARD = 'rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900';

function BoardSkeleton() {
    return (
        <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
                <Skeleton className="h-10 w-full sm:w-64" />
                <Skeleton className="h-10 w-36" />
                <Skeleton className="h-10 w-32" />
            </div>
            <div className="flex gap-3 overflow-hidden">
                {[3, 4, 2, 3].map((cards, column) => (
                    <div key={column} className="w-72 shrink-0 space-y-2 rounded-xl bg-zinc-100 p-2 dark:bg-zinc-900">
                        <Skeleton className="m-1 h-4 w-28" />
                        {Array.from({ length: cards }, (_, card) => (
                            <div key={card} className="space-y-2 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-800">
                                <Skeleton className="h-4 w-4/5" />
                                <Skeleton className="h-3 w-1/2" />
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}

function DashboardSkeleton() {
    return (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
            {['md:col-span-2', 'md:col-span-2', 'md:col-span-2', 'md:col-span-4', 'md:col-span-2', 'md:col-span-3', 'md:col-span-3'].map(
                (span, index) => (
                    <div key={index} className={`${CARD} ${span} space-y-3`}>
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-3 w-1/3" />
                        <Skeleton className={index < 3 ? 'h-10 w-24' : 'h-32 w-full'} />
                    </div>
                )
            )}
        </div>
    );
}

function CardGridSkeleton() {
    return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
                <div key={index} className={`${CARD} space-y-3`}>
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-1/3" />
                </div>
            ))}
        </div>
    );
}

function TableSkeleton() {
    return (
        <div className={`${CARD} space-y-4`}>
            {Array.from({ length: 6 }, (_, index) => (
                <div key={index} className="flex items-center gap-3">
                    <Skeleton className="h-6 w-6 rounded-full" />
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="ml-auto h-4 w-16" />
                </div>
            ))}
        </div>
    );
}

function HomeSkeleton() {
    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {[0, 1, 2].map((index) => (
                    <div key={index} className={`${CARD} space-y-3`}>
                        <Skeleton className="h-3 w-1/2" />
                        <Skeleton className="h-8 w-16" />
                    </div>
                ))}
            </div>
            <div className={`${CARD} space-y-4`}>
                {Array.from({ length: 5 }, (_, index) => (
                    <div key={index} className="flex gap-4">
                        <Skeleton className="h-4 flex-1" />
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-16" />
                    </div>
                ))}
            </div>
        </div>
    );
}

/**
 * Placeholder for the page being navigated to, shaped like that page so
 * the layout doesn't jump when it arrives.
 *
 * @param {Object} props
 * @param {string} props.path - Destination path, without query string.
 * @returns {JSX.Element}
 */
export default function PageSkeleton({ path }) {
    let content = <CardGridSkeleton />;

    if (path === '/') {
        content = <HomeSkeleton />;
    } else if (/^\/boards\/[^/]+$/.test(path)) {
        content = <BoardSkeleton />;
    } else if (/^\/dashboards\/[^/]+$/.test(path)) {
        content = <DashboardSkeleton />;
    } else if (path === '/team') {
        content = <TableSkeleton />;
    }

    return (
        <div role="status" aria-label="Loading page">
            {content}
        </div>
    );
}
