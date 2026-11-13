export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export function methodAllowed(req, res, methods) {
  if (methods.includes(req.method)) return true;
  res.setHeader('Allow', methods.join(', '));
  res.status(405).json({ error: 'Method not allowed.' });
  return false;
}
export function apiError(res, error) {
  const status = error.status || 500;
  if (status >= 500) console.error('Request failed', { type: error.name, status });
  return res.status(status).json({ error: status === 500 ? 'Request failed. Check server configuration and try again.' : error.message });
}
export function jobId(value) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(value)) throw new HttpError(400, 'Invalid job ID.');
  return value;
}
