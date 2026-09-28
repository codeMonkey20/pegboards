/**
 * An error whose message is safe to show to the user.
 */
export class HttpError extends Error {
    /**
     * @param {number} status
     * @param {string} message
     */
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

/**
 * Wraps an API route: enforces allowed methods, requires JSON bodies on
 * writes (which blocks simple cross-site form posts), and turns thrown
 * errors into JSON responses.
 *
 * @param {Object<string, (req: import('next').NextApiRequest, res: import('next').NextApiResponse) => any>} handlers
 *   Map of HTTP method to handler.
 * @returns {(req: import('next').NextApiRequest, res: import('next').NextApiResponse) => Promise<void>}
 */
export function apiHandler(handlers) {
    return async function handler(req, res) {
        const methodHandler = handlers[req.method];

        if (!methodHandler) {
            res.setHeader('Allow', Object.keys(handlers));
            return res.status(405).json({ message: 'Method not allowed' });
        }

        const isWrite = req.method !== 'GET' && req.method !== 'HEAD';
        const contentType = req.headers['content-type'] ?? '';

        if (isWrite && !contentType.startsWith('application/json')) {
            return res.status(415).json({ message: 'Expected a JSON request body' });
        }

        try {
            await methodHandler(req, res);
        } catch (error) {
            if (error instanceof HttpError) {
                return res.status(error.status).json({ message: error.message });
            }

            console.error(`API error on ${req.method} ${req.url}:`, error);
            return res.status(500).json({ message: 'Something went wrong' });
        }
    };
}

/**
 * Parses a positive integer id from a route/query param.
 *
 * @param {unknown} value
 * @returns {number}
 */
export function parseId(value) {
    const id = Number(value);

    if (!Number.isInteger(id) || id <= 0) {
        throw new HttpError(404, 'Not found');
    }

    return id;
}
