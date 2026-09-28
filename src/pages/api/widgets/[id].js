import { WIDGET_WIDTH_VALUES } from '@/lib/constants';
import { requireUser } from '@/server/auth';
import {
    deleteWidget,
    getWidget,
    moveWidget,
    requireEditableDashboard,
    requireWidget,
    updateWidget,
} from '@/server/dashboards';
import { apiHandler, parseId } from '@/server/http';
import { validateWidgetConfig } from '@/server/metrics';
import * as validate from '@/server/validation';

export default apiHandler({
    async PATCH(req, res) {
        const user = await requireUser(req);
        const widget = await requireWidget(parseId(req.query.id));
        const data = validate.body(req);
        const changes = {};

        await requireEditableDashboard(widget.dashboardId, user);

        if (validate.has(data, 'title')) {
            changes.title = validate.string(data.title, 'Title', { min: 1, max: 100 });
        }

        if (validate.has(data, 'width')) {
            changes.width = validate.oneOf(data.width, 'Width', WIDGET_WIDTH_VALUES);
        }

        if (validate.has(data, 'config')) {
            changes.config = validateWidgetConfig(data.config);
        }

        await updateWidget(widget.id, changes);

        if (validate.has(data, 'move')) {
            await moveWidget(widget.id, validate.oneOf(data.move, 'Move', [-1, 1]));
        }

        res.status(200).json(await getWidget(widget.id, user.id));
    },

    async DELETE(req, res) {
        const user = await requireUser(req);
        const widget = await requireWidget(parseId(req.query.id));

        await requireEditableDashboard(widget.dashboardId, user);
        await deleteWidget(widget.id);
        res.status(200).json({ ok: true });
    },
});
