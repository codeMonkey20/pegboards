import { getSessionUser, needsSetup } from './auth';
import { collection } from './db';

/**
 * @typedef {Object} NavData
 * @property {{ id: number, name: string, color: string }[]} projects
 * @property {{ id: number, name: string }[]} dashboards
 */

const BY_NAME = { locale: 'en', strength: 2 };

/**
 * Loads the sidebar lists shown on every signed-in page.
 *
 * @param {number} userId
 * @returns {Promise<NavData>}
 */
async function getNavData(userId) {
    const [projects, dashboards] = await Promise.all([
        (await collection('projects'))
            .find({}, { projection: { name: 1, color: 1 } })
            .collation(BY_NAME)
            .sort({ name: 1 })
            .toArray(),
        (await collection('dashboards'))
            .find({ $or: [{ ownerId: userId }, { isShared: true }] }, { projection: { name: 1 } })
            .collation(BY_NAME)
            .sort({ name: 1 })
            .toArray(),
    ]);

    return {
        projects: projects.map((doc) => ({ id: doc._id, name: doc.name, color: doc.color })),
        dashboards: dashboards.map((doc) => ({ id: doc._id, name: doc.name })),
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
        const user = await getSessionUser(context.req);

        if (!user) {
            const destination = (await needsSetup())
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
                nav: await getNavData(user.id),
            },
        };
    };
}
