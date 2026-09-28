import { requireUser } from '@/server/auth';
import { apiHandler, parseId } from '@/server/http';
import { deleteTimeEntry, getTaskDetail } from '@/server/tasks';

export default apiHandler({
    DELETE(req, res) {
        const user = requireUser(req);
        const taskId = deleteTimeEntry(parseId(req.query.id), user);

        res.status(200).json(getTaskDetail(taskId));
    },
});
