import { WIDGET_WIDTH_VALUES } from '@/lib/constants';
import { requireUser } from '@/server/auth';
import { createWidget, getWidget, requireEditableDashboard } from '@/server/dashboards';
import { apiHandler, parseId } from '@/server/http';
import { validateWidgetConfig } from '@/server/metrics';
import * as validate from '@/server/validation';

export default apiHandler({
    async POST(req, res) {
        const user = await requireUser(req);
        const dashboardId = parseId(req.query.id);
        const data = validate.body(req);

        await requireEditableDashboard(dashboardId, user);

        const widgetId = await createWidget(dashboardId, {
            title: validate.string(data.title, 'Title', { min: 1, max: 100 }),
            width: validate.oneOf(data.width, 'Width', WIDGET_WIDTH_VALUES),
            config: validateWidgetConfig(data.config),
        });

        res.status(201).json(await getWidget(widgetId, user.id));
    },
});
