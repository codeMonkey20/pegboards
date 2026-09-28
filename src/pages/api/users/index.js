import { requireUser } from '@/server/auth';
import { apiHandler } from '@/server/http';
import { createUser, getUser, listUsers } from '@/server/users';
import * as validate from '@/server/validation';

export default apiHandler({
    GET(req, res) {
        requireUser(req);
        res.status(200).json(listUsers());
    },

    POST(req, res) {
        requireUser(req, { admin: true });

        const data = validate.body(req);
        const userId = createUser({
            name: validate.string(data.name, 'Name', { min: 1, max: 100 }),
            email: validate.email(data.email),
            password: validate.password(data.password),
            role: validate.oneOf(data.role ?? 'member', 'Role', ['admin', 'member']),
        });

        res.status(201).json(getUser(userId));
    },
});
