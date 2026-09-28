import { requireUser } from '@/server/auth';
import { apiHandler, parseId } from '@/server/http';
import { deleteProject, requireProject, updateProject } from '@/server/projects';
import * as validate from '@/server/validation';

export default apiHandler({
    PATCH(req, res) {
        requireUser(req);

        const id = parseId(req.query.id);
        const data = validate.body(req);
        const changes = {};

        requireProject(id);

        if (validate.has(data, 'name')) {
            changes.name = validate.string(data.name, 'Name', { min: 1, max: 100 });
        }

        if (validate.has(data, 'description')) {
            changes.description = validate.string(data.description, 'Description', { max: 1000 });
        }

        if (validate.has(data, 'color')) {
            changes.color = validate.color(data.color, 'Color');
        }

        updateProject(id, changes);
        res.status(200).json(requireProject(id));
    },

    DELETE(req, res) {
        requireUser(req, { admin: true });

        const id = parseId(req.query.id);

        requireProject(id);
        deleteProject(id);
        res.status(200).json({ ok: true });
    },
});
