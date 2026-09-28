import { requireUser } from '@/server/auth';
import { apiHandler } from '@/server/http';
import { createUser, getUser, listUsers } from '@/server/users';
import * as validate from '@/server/validation';

export default apiHandler({
    async GET(req, res) {
        await requireUser(req);
        res.status(200).json(await listUsers());
    },

    async POST(req, res) {
        await requireUser(req, { admin: true });

        const data = validate.body(req);
        const userId = await createUser({
            name: validate.string(data.name, 'Name', { min: 1, max: 100 }),
            email: validate.email(data.email),
            password: validate.password(data.password),
            role: validate.oneOf(data.role ?? 'member', 'Role', ['admin', 'member']),
        });

        res.status(201).json(await getUser(userId));
    },
});
