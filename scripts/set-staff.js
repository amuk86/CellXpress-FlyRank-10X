import nextEnv from "@next/env";
const { loadEnvConfig } = nextEnv;
import { getAdminAuth } from "../lib/firebaseAdmin.js";
loadEnvConfig(process.cwd());
const uid = process.argv[2];
if (!uid || uid.startsWith("--"))
  throw new Error("Usage: npm run staff:grant -- FIREBASE_USER_UID [--revoke]");
const auth = getAdminAuth(),
  user = await auth.getUser(uid);
await auth.setCustomUserClaims(uid, {
  ...user.customClaims,
  staff: !process.argv.includes("--revoke"),
});
if (process.argv.includes("--revoke")) await auth.revokeRefreshTokens(uid);
console.log(
  process.argv.includes("--revoke")
    ? "Staff access revoked."
    : "Staff access granted. Sign out and sign back in to refresh claims.",
);
