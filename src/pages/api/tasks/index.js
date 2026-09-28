import { requireUser } from '@/server/auth';
import { apiHandler, HttpError } from '@/server/http';
import { createTask, parseTaskInput } from '@/server/tasks';
import * as validate from '@/server/validation';

export default apiHandler({
    POST(req, res) {
        const user = requireUser(req);
        const input = parseTaskInput(validate.body(req));

        if (!input.title) {
            throw new HttpError(400, 'Title is required');
        }

        if (!input.statusId) {
            throw new HttpError(400, 'Status is required');
        }

        res.status(201).json(createTask({ ...input, creatorId: user.id }));
    },
});
