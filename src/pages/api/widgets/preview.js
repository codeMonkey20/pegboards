import { requireUser } from '@/server/auth';
import { apiHandler } from '@/server/http';
import { computeMetric, validateWidgetConfig } from '@/server/metrics';
import * as validate from '@/server/validation';

/**
 * Computes a widget's data without saving it, for the live preview in the editor.
 */
export default apiHandler({
    POST(req, res) {
        const user = requireUser(req);
        const data = validate.body(req);

        res.status(200).json(computeMetric(validateWidgetConfig(data.config), user.id));
    },
});
