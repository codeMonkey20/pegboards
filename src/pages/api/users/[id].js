import { requireUser } from '@/server/auth';
import { apiHandler, HttpError, parseId } from '@/server/http';
import { getUser, updateUser } from '@/server/users';
import * as validate from '@/server/validation';

/**
 * Admins can edit anyone; members can edit their own name, email,
 * color and password.
 */
export default apiHandler({
    PATCH(req, res) {
        const currentUser = requireUser(req);
        const id = parseId(req.query.id);
        const isSelf = currentUser.id === id;
        const isAdmin = currentUser.role === 'admin';
        const data = validate.body(req);

        if (!isSelf && !isAdmin) {
            throw new HttpError(403, 'Only admins can edit other people');
        }

        if (!getUser(id)) {
            throw new HttpError(404, 'User not found');
        }

        if (!isAdmin && (validate.has(data, 'role') || validate.has(data, 'isActive'))) {
            throw new HttpError(403, 'Only admins can change roles or deactivate accounts');
        }

        if (isSelf && data.isActive === false) {
            throw new HttpError(400, "You can't deactivate your own account");
        }

        const changes = {};

        if (validate.has(data, 'name')) {
            changes.name = validate.string(data.name, 'Name', { min: 1, max: 100 });
        }

        if (validate.has(data, 'email')) {
            changes.email = validate.email(data.email);
        }

        if (validate.has(data, 'color')) {
            changes.color = validate.color(data.color, 'Color');
        }

        if (validate.has(data, 'password')) {
            changes.password = validate.password(data.password);
        }

        if (validate.has(data, 'role')) {
            changes.role = validate.oneOf(data.role, 'Role', ['admin', 'member']);
        }

        if (validate.has(data, 'isActive')) {
            changes.isActive = validate.boolean(data.isActive, 'Active');
        }

        updateUser(id, changes);
        res.status(200).json(getUser(id));
    },
});
