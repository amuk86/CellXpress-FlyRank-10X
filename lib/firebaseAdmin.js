import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
export function getAdminApp() {
  if (getApps().length) return getApps()[0];
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const emulator = process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST;
  if (emulator) {
    if (!projectId?.startsWith('demo-') || ![process.env.FIRESTORE_EMULATOR_HOST, process.env.FIREBASE_AUTH_EMULATOR_HOST].every(h => /^(localhost|127\.0\.0\.1):\d+$/.test(h || ''))) throw new Error('Both emulators must use loopback hosts and a demo- project.');
    return initializeApp({ projectId });
  }
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) throw new Error('Firebase Admin is not configured. See README.');
  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}
export const getDb = () => getFirestore(getAdminApp());
export const getAdminAuth = () => getAuth(getAdminApp());
