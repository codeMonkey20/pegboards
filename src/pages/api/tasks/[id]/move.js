import { requireUser } from '@/server/auth';
import { apiHandler, parseId } from '@/server/http';
import { listBoardTasks, moveTask } from '@/server/tasks';
import * as validate from '@/server/validation';

/**
 * Moves a task to a position in a column and returns the whole board's
 * tasks so the client can reconcile with the saved order.
 */
export default apiHandler({
    async POST(req, res) {
        await requireUser(req);

        const data = validate.body(req);
        const task = await moveTask(
            parseId(req.query.id),
            validate.id(data.statusId, 'Status'),
            validate.number(data.index, 'Index', { min: 0, integer: true })
        );

        res.status(200).json(await listBoardTasks(task.projectId));
    },
});
