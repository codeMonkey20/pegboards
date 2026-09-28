import { endSession } from '@/server/auth';
import { apiHandler } from '@/server/http';

export default apiHandler({
    async POST(req, res) {
        await endSession(req, res);
        res.status(200).json({ ok: true });
    },
});
