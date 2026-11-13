import nextEnv from "@next/env";
const { loadEnvConfig } = nextEnv;
import { getDb, getAdminAuth } from "../lib/firebaseAdmin.js";
loadEnvConfig(process.cwd());
// This script cannot seed or clean a live project.
if (
  !process.env.FIREBASE_PROJECT_ID?.startsWith("demo-") ||
  !process.env.FIREBASE_AUTH_EMULATOR_HOST ||
  !process.env.FIRESTORE_EMULATOR_HOST
)
  throw new Error(
    "Demo seeding requires local Firebase emulators and a demo- project.",
  );
const db = getDb(),
  auth = getAdminAuth();
const ids = ["demo-screen", "demo-battery", "demo-speaker", "demo-collected"];
if (process.argv.includes("--clean")) {
  const batch = db.batch();
  for (const id of ids) batch.delete(db.collection("jobs").doc(id));
  await batch.commit();
  try {
    await auth.deleteUser("demo-staff");
  } catch (e) {
    if (e.code !== "auth/user-not-found") throw e;
  }
  console.log(
    "Removed only the four named seed jobs and demo-staff account. Other jobs remain.",
  );
} else {
  try {
    await auth.getUser("demo-staff");
  } catch (e) {
    if (e.code !== "auth/user-not-found") throw e;
    await auth.createUser({
      uid: "demo-staff",
      email: "staff@cellxpress.example",
      password: "DemoRepair!2026",
      displayName: "Demo Staff",
    });
  }
  await auth.setCustomUserClaims("demo-staff", { staff: true });
  const now = Date.now(),
    hour = 3600000;
  const fixtures = [
    [
      "demo-screen",
      "Lindi Demo",
      "Samsung Galaxy A24",
      "Cracked display",
      650,
      "in_progress",
      "unpaid",
      "",
      52,
    ],
    [
      "demo-battery",
      "Kabelo Sample",
      "iPhone 12",
      "Battery drains quickly",
      450,
      "in_progress",
      "unpaid",
      "",
      3,
    ],
    [
      "demo-speaker",
      "Mira Example",
      "Huawei P30",
      "Speaker crackles",
      300,
      "ready_for_pickup",
      "unpaid",
      "Speaker replaced and tested.",
      25,
    ],
    [
      "demo-collected",
      "Thabo Fiction",
      "Nokia G22",
      "Charging port loose",
      250,
      "completed",
      "paid",
      "Port replaced; charging tested.",
      72,
    ],
  ];
  const batch = db.batch();
  for (const [
    id,
    customerName,
    deviceModel,
    faultDescription,
    fee,
    status,
    paymentStatus,
    workDone,
    age,
  ] of fixtures)
    batch.set(db.collection("jobs").doc(id), {
      customerName,
      deviceModel,
      faultDescription,
      fee,
      status,
      paymentStatus,
      workDone,
      diagnosis: "",
      customerPhone: "",
      reviewed: true,
      createdBy: "demo-staff",
      demo: true,
      createdAt: new Date(now - age * hour),
      updatedAt: new Date(now),
      readyAt: status !== "in_progress" ? new Date(now - hour) : null,
      completedAt: status === "completed" ? new Date(now) : null,
    });
  await batch.commit();
  console.log(
    "Seeded four fictional repairs. Local staff: staff@cellxpress.example / DemoRepair!2026",
  );
}
process.exit(0);
