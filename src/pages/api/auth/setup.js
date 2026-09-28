import { needsSetup, startSession } from '@/server/auth';
import { apiHandler, HttpError } from '@/server/http';
import { seedDemoData } from '@/server/seed';
import { createUser } from '@/server/users';
import * as validate from '@/server/validation';

/**
 * Creates the first (admin) account on a fresh install.
 */
export default apiHandler({
    async POST(req, res) {
        if (!(await needsSetup())) {
            throw new HttpError(409, 'This workspace is already set up');
        }

        const data = validate.body(req);
        const userId = await createUser({
            name: validate.string(data.name, 'Name', { min: 1, max: 100 }),
            email: validate.email(data.email),
            password: validate.password(data.password),
            role: 'admin',
        });
        let demoDataLoaded = false;

        // Sample data is optional: if it fails part-way, keep the admin
        // account so the workspace is still usable.
        if (data.includeDemoData === true) {
            try {
                await seedDemoData(userId);
                demoDataLoaded = true;
            } catch (error) {
                console.error('Loading sample data failed:', error);
            }
        }

        await startSession(res, userId);
        res.status(201).json({ ok: true, demoDataLoaded });
    },
});
