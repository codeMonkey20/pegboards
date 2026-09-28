/**
 * Calls one of the app's JSON API routes.
 *
 * @param {string} url
 * @param {Object} [options]
 * @param {'GET'|'POST'|'PATCH'|'DELETE'} [options.method='GET']
 * @param {unknown} [options.body]
 * @returns {Promise<any>} The parsed JSON response.
 * @throws {Error} With the server's message when the request fails.
 */
export async function api(url, { method = 'GET', body } = {}) {
    const response = await fetch(url, {
        method,
        headers: method === 'GET' ? undefined : { 'Content-Type': 'application/json' },
        body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
        throw new Error(data?.message ?? `Request failed (${response.status})`);
    }

    return data;
}
