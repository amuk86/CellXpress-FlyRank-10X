import { withStaff } from '../../../../lib/auth.js';
import { updateJob } from '../../../../lib/jobs.js';
import { apiError, methodAllowed, jobId } from '../../../../lib/errors.js';
export default withStaff(async function handler(req, res) {
  if (!methodAllowed(req, res, ['PATCH'])) return;
  res.setHeader('Cache-Control', 'no-store');
  try { return res.status(200).json({ job: await updateJob(jobId(req.query.id), req.body) }); }
  catch (error) { return apiError(res, error); }
});
