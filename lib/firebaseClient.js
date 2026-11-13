import { initializeApp, getApps } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
let auth;
export function getClientAuth() {
  if (auth) return auth;
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  };
  if (!config.apiKey || !config.projectId) throw new Error('Firebase sign-in is not configured. Follow README setup.');
  const app = getApps()[0] || initializeApp(config);
  auth = getAuth(app);
  if (process.env.NEXT_PUBLIC_USE_EMULATORS === 'true') {
    const host = process.env.NEXT_PUBLIC_AUTH_EMULATOR_URL || 'http://127.0.0.1:9099';
    if (!['localhost', '127.0.0.1'].includes(new URL(host).hostname) || !config.projectId.startsWith('demo-')) throw new Error('Emulators require a demo project and loopback host.');
    connectAuthEmulator(auth, host, { disableWarnings: true });
  }
  return auth;
}
