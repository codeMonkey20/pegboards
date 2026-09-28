import { getSessionUser, needsSetup } from './auth';
import { getDb } from './db';

/**
 * @typedef {Object} NavData
 * @property {{ id: number, name: string, color: string }[]} projects
 * @property {{ id: number, name: string }[]} dashboards
 */

/**
 * Loads the sidebar lists shown on every signed-in page.
 *
 * @param {number} userId
 * @returns {NavData}
 */
function getNavData(userId) {
    const db = getDb();

    const projects = db.prepare('SELECT id, name, color FROM projects ORDER BY name COLLATE NOCASE').all();
    const dashboards = db
        .prepare(
            `SELECT id, name FROM dashboards
             WHERE owner_id = ? OR is_shared = 1
             ORDER BY name COLLATE NOCASE`
        )
        .all(userId);

    return {
        projects: projects.map((row) => ({ ...row })),
        dashboards: dashboards.map((row) => ({ ...row })),
    };
}

/**
 * Wraps `getServerSideProps` for signed-in pages. Redirects anonymous
 * visitors to /login (or /setup on a fresh install) and adds the
 * current user and sidebar data to the page props.
 *
 * @param {(args: { context: import('next').GetServerSidePropsContext, user: import('./auth').SessionUser }) => Promise<Object>|Object} [getProps]
 *   Returns a normal getServerSideProps result.
 * @returns {import('next').GetServerSideProps}
 */
export function withPageAuth(getProps) {
    return async function getServerSideProps(context) {
        const user = getSessionUser(context.req);

        if (!user) {
            const destination = needsSetup()
                ? '/setup'
                : `/login?next=${encodeURIComponent(context.resolvedUrl)}`;

            return { redirect: { destination, permanent: false } };
        }

        const result = getProps ? await getProps({ context, user }) : { props: {} };

        if (!('props' in result)) {
            return result;
        }

        return {
            ...result,
            props: {
                ...result.props,
                currentUser: user,
                nav: getNavData(user.id),
            },
        };
    };
}
