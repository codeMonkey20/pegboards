import { requireUser } from '@/server/auth';
import { apiHandler, parseId } from '@/server/http';
import { addComment, getTaskDetail } from '@/server/tasks';
import * as validate from '@/server/validation';

export default apiHandler({
    POST(req, res) {
        const user = requireUser(req);
        const taskId = parseId(req.query.id);
        const data = validate.body(req);

        addComment(taskId, user.id, validate.string(data.body, 'Comment', { min: 1, max: 5000 }));
        res.status(201).json(getTaskDetail(taskId));
    },
});
