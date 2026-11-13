import { getJob } from '../../../../lib/jobs.js';
import { apiError, methodAllowed, jobId } from '../../../../lib/errors.js';
export default async function handler(req, res) {
  if (!methodAllowed(req, res, ['GET'])) return;
  res.setHeader('Cache-Control', 'no-store');
  try { return res.status(200).json({ job: await getJob(jobId(req.query.id)) }); }
  catch (error) { return apiError(res, error); }
}
