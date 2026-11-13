import { withStaff } from "../../lib/auth.js";
import { extractJobDetails } from "../../lib/gemini.js";
import { getDb } from "../../lib/firebaseAdmin.js";
import { HttpError, methodAllowed } from "../../lib/errors.js";
export const config = { api: { bodyParser: { sizeLimit: "4mb" } } };
export default withStaff(async function handler(req, res) {
  if (!methodAllowed(req, res, ["POST"])) return;
  const db = getDb();
  // Shared per-user quota, enforced across server processes. No media in logs.
  const bucket = db.collection("aiRateLimits").doc(req.staff.uid);
  await db.runTransaction(async (tx) => {
    const doc = await tx.get(bucket),
      previous = doc.data(),
      now = Date.now();
    const fresh = !previous || now - previous.startedAt > 60000;
    if (!fresh && previous.count >= 5)
      throw new HttpError(429, "Wait a minute before another extraction.");
    tx.set(bucket, {
      startedAt: fresh ? now : previous.startedAt,
      count: fresh ? 1 : previous.count + 1,
    });
  });
  const result = await extractJobDetails(req.body);
  const log = await db.collection("aiUsage").add({
    ...result.usage,
    staffUid: req.staff.uid,
    outcome: result.error ? "rejected" : "validated",
  });
  if (result.error) throw result.error;
  return res
    .status(200)
    .json({ ...result.extracted, usage: { ...result.usage, id: log.id } });
});
