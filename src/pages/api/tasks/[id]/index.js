import { requireUser } from '@/server/auth';
import { apiHandler, parseId } from '@/server/http';
import { deleteTask, getTaskDetail, getTaskSummary, parseTaskInput, updateTask } from '@/server/tasks';
import * as validate from '@/server/validation';

export default apiHandler({
    async GET(req, res) {
        await requireUser(req);
        res.status(200).json(await getTaskDetail(parseId(req.query.id)));
    },

    async PATCH(req, res) {
        await requireUser(req);

        const id = parseId(req.query.id);

        await updateTask(id, await parseTaskInput(validate.body(req)));
        res.status(200).json(await getTaskDetail(id));
    },

    async DELETE(req, res) {
        await requireUser(req);

        const id = parseId(req.query.id);

        await getTaskSummary(id);
        await deleteTask(id);
        res.status(200).json({ ok: true });
    },
});
