import { requireUser } from '@/server/auth';
import { rangeHours } from '@/lib/duration';
import { apiHandler, HttpError, parseId } from '@/server/http';
import { addTimeEntry, getTaskDetail } from '@/server/tasks';
import * as validate from '@/server/validation';

/**
 * Logs time. Send either `hours`, or `startTime` and `endTime` (`HH:MM`,
 * same day), in which case the hours are worked out from the range.
 */
export default apiHandler({
    async POST(req, res) {
        const user = await requireUser(req);
        const taskId = parseId(req.query.id);
        const data = validate.body(req);
        const isRange = validate.has(data, 'startTime') || validate.has(data, 'endTime');
        const entry = {
            userId: user.id,
            date: validate.date(data.date, 'Date'),
            note: validate.string(data.note ?? '', 'Note', { max: 500 }),
        };

        if (isRange) {
            entry.startTime = validate.time(data.startTime, 'Start time');
            entry.endTime = validate.time(data.endTime, 'End time');
            entry.hours = rangeHours(entry.startTime, entry.endTime);

            if (entry.hours === null) {
                throw new HttpError(400, 'End time must be after start time');
            }
        } else {
            entry.hours = validate.number(data.hours, 'Hours', { min: 0.05, max: 24 });
        }

        await addTimeEntry(taskId, entry);

        res.status(201).json(await getTaskDetail(taskId));
    },
});
