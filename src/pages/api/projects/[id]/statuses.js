import { requireUser } from '@/server/auth';
import { apiHandler, parseId } from '@/server/http';
import { createStatus, requireProject } from '@/server/projects';
import * as validate from '@/server/validation';

export default apiHandler({
    async POST(req, res) {
        await requireUser(req);

        const projectId = parseId(req.query.id);
        const data = validate.body(req);

        await requireProject(projectId);

        const status = await createStatus(projectId, {
            name: validate.string(data.name, 'Name', { min: 1, max: 50 }),
            color: validate.color(data.color ?? '#898781', 'Color'),
            isDone: data.isDone === true,
        });

        res.status(201).json(status);
    },
});
