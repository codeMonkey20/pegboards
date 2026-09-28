import { requireUser } from '@/server/auth';
import { apiHandler, parseId } from '@/server/http';
import { deleteTask, getTaskDetail, getTaskSummary, parseTaskInput, updateTask } from '@/server/tasks';
import * as validate from '@/server/validation';

export default apiHandler({
    GET(req, res) {
        requireUser(req);
        res.status(200).json(getTaskDetail(parseId(req.query.id)));
    },

    PATCH(req, res) {
        requireUser(req);

        const id = parseId(req.query.id);

        updateTask(id, parseTaskInput(validate.body(req)));
        res.status(200).json(getTaskDetail(id));
    },

    DELETE(req, res) {
        requireUser(req);

        const id = parseId(req.query.id);

        getTaskSummary(id);
        deleteTask(id);
        res.status(200).json({ ok: true });
    },
});
