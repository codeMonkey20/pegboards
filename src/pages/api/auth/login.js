import { startSession, verifyPassword } from '@/server/auth';
import { apiHandler, HttpError } from '@/server/http';
import { getCredentials } from '@/server/users';
import * as validate from '@/server/validation';

export default apiHandler({
    POST(req, res) {
        const data = validate.body(req);
        const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
        const password = typeof data.password === 'string' ? data.password : '';
        const credentials = getCredentials(email);

        // Same message either way so the form doesn't reveal which emails exist.
        if (!credentials || !credentials.isActive || !verifyPassword(password, credentials.passwordHash)) {
            throw new HttpError(401, 'Email or password is incorrect');
        }

        startSession(res, credentials.id);
        res.status(200).json({ ok: true });
    },
});
