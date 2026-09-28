import { requireUser } from '@/server/auth';
import { apiHandler, parseId } from '@/server/http';
import { deleteStatus, listStatuses, moveStatus, requireStatus, updateStatus } from '@/server/projects';
import * as validate from '@/server/validation';

/**
 * Every response returns the board's full column list, since a change to
 * one column (e.g. reordering) can affect the others.
 */
export default apiHandler({
    async PATCH(req, res) {
        await requireUser(req);

        const id = parseId(req.query.id);
        const data = validate.body(req);
        const status = await requireStatus(id);
        const changes = {};

        if (validate.has(data, 'name')) {
            changes.name = validate.string(data.name, 'Name', { min: 1, max: 50 });
        }

        if (validate.has(data, 'color')) {
            changes.color = validate.color(data.color, 'Color');
        }

        if (validate.has(data, 'isDone')) {
            changes.isDone = validate.boolean(data.isDone, 'Done');
        }

        await updateStatus(id, changes);

        if (validate.has(data, 'move')) {
            await moveStatus(id, validate.oneOf(data.move, 'Move', [-1, 1]));
        }

        res.status(200).json(await listStatuses(status.projectId));
    },

    async DELETE(req, res) {
        await requireUser(req);

        const id = parseId(req.query.id);
        const status = await requireStatus(id);

        await deleteStatus(id);
        res.status(200).json(await listStatuses(status.projectId));
    },
});
