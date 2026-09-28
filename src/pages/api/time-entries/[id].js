import { requireUser } from '@/server/auth';
import { apiHandler, parseId } from '@/server/http';
import { deleteTimeEntry, getTaskDetail } from '@/server/tasks';

export default apiHandler({
    async DELETE(req, res) {
        const user = await requireUser(req);
        const taskId = await deleteTimeEntry(parseId(req.query.id), user);

        res.status(200).json(await getTaskDetail(taskId));
    },
});
