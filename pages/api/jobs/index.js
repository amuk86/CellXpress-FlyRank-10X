import { listJobs, createJob } from '../../../lib/jobs.js';
import { apiError, methodAllowed } from '../../../lib/errors.js';
export default async function handler(req, res) {
  if (!methodAllowed(req, res, ['GET','POST'])) return;
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method === 'GET') return res.status(200).json({ jobs: await listJobs() });
    return res.status(201).json({ id: await createJob(req.body, 'staff') });
  } catch (error) { return apiError(res, error); }
}
