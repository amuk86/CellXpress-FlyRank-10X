import { getDb } from './firebaseAdmin.js';
import { validateJob, validateUpdate } from './validation.js';
import { HttpError } from './errors.js';
export function serializeJob(doc) {
  const data = doc.data();
  for (const key of ['createdAt','updatedAt','readyAt','completedAt']) data[key] = data[key]?.toMillis?.() ?? data[key]?.getTime?.() ?? null;
  return { ...data, id: doc.id };
}
export async function listJobs() {
  const snapshot = await getDb().collection('jobs').orderBy('createdAt', 'desc').limit(200).get();
  return snapshot.docs.map(serializeJob);
}
export async function createJob(input, uid) {
  const fields = validateJob(input);
  const now = new Date();
  const ref = await getDb().collection('jobs').add({ ...fields, status: 'in_progress', paymentStatus: 'unpaid', createdAt: now, updatedAt: now, readyAt: null, completedAt: null, createdBy: uid });
  return ref.id;
}
export async function getJob(id) {
  const doc = await getDb().collection('jobs').doc(id).get();
  if (!doc.exists) throw new HttpError(404, 'Job not found.');
  return serializeJob(doc);
}
export async function updateJob(id, input) {
  const db = getDb();
  const ref = db.collection('jobs').doc(id);
  await db.runTransaction(async tx => {
    const doc = await tx.get(ref);
    if (!doc.exists) throw new HttpError(404, 'Job not found.');
    tx.update(ref, validateUpdate(input, doc.data()));
  });
  return getJob(id);
}
