import { requireUser } from '@/server/auth';
import { createDashboard } from '@/server/dashboards';
import { apiHandler } from '@/server/http';
import * as validate from '@/server/validation';

export default apiHandler({
    POST(req, res) {
        const user = requireUser(req);
        const data = validate.body(req);
        const id = createDashboard(user.id, validate.string(data.name, 'Name', { min: 1, max: 100 }));

        res.status(201).json({ id });
    },
});
