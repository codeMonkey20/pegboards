import { endSession } from '@/server/auth';
import { apiHandler } from '@/server/http';

export default apiHandler({
    POST(req, res) {
        endSession(req, res);
        res.status(200).json({ ok: true });
    },
});
