import { withStaff } from '../../../../lib/auth.js';
import { getJob } from '../../../../lib/jobs.js';
import { generateReport } from '../../../../lib/report.js';
import { methodAllowed, jobId } from '../../../../lib/errors.js';
export default withStaff(async function handler(req, res) {
  if (!methodAllowed(req, res, ['GET'])) return;
  const id = jobId(req.query.id);
  const pdf = await generateReport(await getJob(id));
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="CellXpress-${id}.pdf"`);
  return res.status(200).send(pdf);
});
