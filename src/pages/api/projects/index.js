import { COLORS } from '@/lib/constants';
import { requireUser } from '@/server/auth';
import { apiHandler } from '@/server/http';
import { createProject } from '@/server/projects';
import * as validate from '@/server/validation';

export default apiHandler({
    POST(req, res) {
        const user = requireUser(req);
        const data = validate.body(req);
        const id = createProject({
            name: validate.string(data.name, 'Name', { min: 1, max: 100 }),
            description: validate.string(data.description ?? '', 'Description', { max: 1000 }),
            color: validate.color(data.color ?? COLORS[0], 'Color'),
            createdBy: user.id,
        });

        res.status(201).json({ id });
    },
});
