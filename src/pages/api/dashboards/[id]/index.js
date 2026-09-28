import { requireUser } from '@/server/auth';
import { deleteDashboard, requireDashboard, requireEditableDashboard, updateDashboard } from '@/server/dashboards';
import { apiHandler, parseId } from '@/server/http';
import * as validate from '@/server/validation';

export default apiHandler({
    async PATCH(req, res) {
        const user = await requireUser(req);
        const id = parseId(req.query.id);
        const data = validate.body(req);
        const changes = {};

        await requireEditableDashboard(id, user);

        if (validate.has(data, 'name')) {
            changes.name = validate.string(data.name, 'Name', { min: 1, max: 100 });
        }

        if (validate.has(data, 'isShared')) {
            changes.isShared = validate.boolean(data.isShared, 'Shared');
        }

        await updateDashboard(id, changes);
        res.status(200).json(await requireDashboard(id, user));
    },

    async DELETE(req, res) {
        const user = await requireUser(req);
        const id = parseId(req.query.id);

        await requireEditableDashboard(id, user);
        await deleteDashboard(id);
        res.status(200).json({ ok: true });
    },
});
