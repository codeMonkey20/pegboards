import { needsSetup, startSession } from '@/server/auth';
import { transaction } from '@/server/db';
import { apiHandler, HttpError } from '@/server/http';
import { seedDemoData } from '@/server/seed';
import { createUser } from '@/server/users';
import * as validate from '@/server/validation';

/**
 * Creates the first (admin) account on a fresh install.
 */
export default apiHandler({
    POST(req, res) {
        if (!needsSetup()) {
            throw new HttpError(409, 'This workspace is already set up');
        }

        const data = validate.body(req);
        const account = {
            name: validate.string(data.name, 'Name', { min: 1, max: 100 }),
            email: validate.email(data.email),
            password: validate.password(data.password),
            role: 'admin',
        };

        // All or nothing, so a failed seed can't leave a half-set-up workspace.
        const userId = transaction(() => {
            const id = createUser(account);

            if (data.includeDemoData === true) {
                seedDemoData(id);
            }

            return id;
        });

        startSession(res, userId);
        res.status(201).json({ ok: true });
    },
});
