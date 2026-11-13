import nextEnv from "@next/env";
import { getDb } from "../lib/firebaseAdmin.js";
nextEnv.loadEnvConfig(process.cwd());
const snapshot = await getDb()
  .collection("aiUsage")
  .orderBy("timestamp", "desc")
  .limit(10)
  .get();
console.log(
  JSON.stringify(
    snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
    null,
    2,
  ),
);
process.exit(0);
