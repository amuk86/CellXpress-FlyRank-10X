import test from "node:test";
import assert from "node:assert/strict";
import nextEnv from "@next/env";
const { loadEnvConfig } = nextEnv;
import { getAdminAuth, getDb } from "../../lib/firebaseAdmin.js";
import extractHandler from "../../pages/api/extract.js";
loadEnvConfig(process.cwd());
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
async function signIn(email, password) {
  const res = await fetch(
    `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  const data = await res.json();
  assert.ok(res.ok, "Emulator sign-in succeeds");
  return data.idToken;
}
test("Firebase + HTTP: authorization, persistent jobs, lifecycle, reports and AI usage", async () => {
  assert.ok(
    process.env.FIREBASE_PROJECT_ID?.startsWith("demo-"),
    "Integration tests require a demo project",
  );
  assert.ok(
    process.env.FIREBASE_AUTH_EMULATOR_HOST &&
      process.env.FIRESTORE_EMULATOR_HOST,
    "Start both emulators first",
  );
  const token = await signIn("staff@cellxpress.example", "DemoRepair!2026");
  const request = (path, method = "GET", body, auth = token) =>
    fetch(base + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  for (const [path, method] of [
    ["/api/jobs", "GET"],
    ["/api/jobs", "POST"],
    ["/api/jobs/missing", "GET"],
    ["/api/jobs/missing/status", "PATCH"],
    ["/api/jobs/missing/report", "GET"],
    ["/api/extract", "POST"],
  ])
    assert.equal(
      (await request(path, method, method === "GET" ? undefined : {}, null))
        .status,
      401,
    );
  assert.equal(
    (await request("/api/jobs", "GET", undefined, "not-a-valid-token")).status,
    401,
  );
  const auth = getAdminAuth();
  const outsider = await auth.createUser({
    email: `outsider-${Date.now()}@example.test`,
    password: "TestOnly!2026",
  });
  let id, usageId;
  try {
    const outsiderToken = await signIn(outsider.email, "TestOnly!2026");
    assert.equal(
      (await request("/api/jobs", "GET", undefined, outsiderToken)).status,
      403,
    );
    assert.equal((await request("/api/jobs", "DELETE")).status, 405);
    assert.equal(
      (await request("/api/jobs", "POST", { customerName: "Incomplete" }))
        .status,
      400,
    );
    assert.equal((await request("/api/jobs/missing/report")).status, 404);
    const res = await request("/api/jobs", "POST", {
      customerName: "Integration Fiction",
      deviceModel: "Test Phone",
      faultDescription: "Cracked screen",
      fee: 0,
      reviewed: true,
    });
    assert.equal(res.status, 201);
    id = (await res.json()).id;
    const stored = await getDb().collection("jobs").doc(id).get();
    assert.equal(stored.data().createdBy, "demo-staff");
    assert.equal((await (await request(`/api/jobs/${id}`)).json()).job.fee, 0);
    assert.ok(
      (await (await request("/api/jobs")).json()).jobs.some((j) => j.id === id),
    );
    assert.equal(
      (
        await request(`/api/jobs/${id}/status`, "PATCH", {
          status: "completed",
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await request(`/api/jobs/${id}/status`, "PATCH", {
          status: "ready_for_pickup",
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await request(`/api/jobs/${id}/status`, "PATCH", {
          workDone: "Test replacement",
          diagnosis: "Screen damaged",
          status: "ready_for_pickup",
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await request(`/api/jobs/${id}/status`, "PATCH", {
          status: "completed",
        })
      ).status,
      409,
    );
    const ready = (await (await request(`/api/jobs/${id}`)).json()).job;
    assert.ok(ready.readyAt);
    assert.equal(ready.paymentStatus, "unpaid");
    assert.equal(
      (
        await request(`/api/jobs/${id}/status`, "PATCH", {
          paymentStatus: "paid",
          status: "completed",
        })
      ).status,
      200,
    );
    const final = (await (await request(`/api/jobs/${id}`)).json()).job;
    assert.ok(final.completedAt);
    assert.equal(final.readyAt, ready.readyAt);
    assert.equal(
      (await request(`/api/jobs/${id}/status`, "PATCH", { fee: 99 })).status,
      409,
    );
    const pdf = await request(`/api/jobs/${id}/report`);
    assert.equal(pdf.status, 200);
    assert.match(pdf.headers.get("content-type"), /application\/pdf/);
    assert.equal(
      Buffer.from(await pdf.arrayBuffer())
        .subarray(0, 5)
        .toString(),
      "%PDF-",
    );
    // Use the real protected handler and real emulator store, mock only Gemini.
    const originalFetch = globalThis.fetch,
      oldKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = "test-only";
    try {
      globalThis.fetch = async (url, opts) =>
        String(url).startsWith("https://generativelanguage.googleapis.com/")
          ? {
              ok: true,
              json: async () => ({
                candidates: [
                  {
                    finishReason: "STOP",
                    content: {
                      parts: [
                        {
                          text: JSON.stringify({
                            customerName: "AI Fiction",
                            deviceModel: null,
                            fee: null,
                            faultDescription: null,
                            confidence: {
                              customerName: 0.8,
                              deviceModel: 0,
                              fee: 0,
                              faultDescription: 0,
                            },
                            evidence: {
                              customerName: "Voice says AI Fiction",
                              deviceModel: "",
                              fee: "",
                              faultDescription: "",
                            },
                            conflicts: [],
                          }),
                        },
                      ],
                    },
                  },
                ],
                usageMetadata: {
                  promptTokenCount: 30,
                  candidatesTokenCount: 10,
                  totalTokenCount: 40,
                },
              }),
            }
          : originalFetch(url, opts);
      const res = {
        headers: {},
        statusCode: 200,
        setHeader(k, v) {
          this.headers[k] = v;
        },
        status(n) {
          this.statusCode = n;
          return this;
        },
        json(body) {
          this.body = body;
          return this;
        },
      };
      await extractHandler(
        {
          method: "POST",
          headers: { authorization: `Bearer ${token}` },
          body: { audioBase64: "YQ==", audioMimeType: "audio/webm" },
        },
        res,
      );
      assert.equal(res.statusCode, 200);
      usageId = res.body.usage.id;
      const audit = (
        await getDb().collection("aiUsage").doc(usageId).get()
      ).data();
      assert.equal(audit.outcome, "validated");
      assert.equal(audit.inputTokens, 30);
      assert.equal(audit.staffUid, "demo-staff");
      assert.equal(audit.audioBase64, undefined);
    } finally {
      globalThis.fetch = originalFetch;
      if (oldKey === undefined) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = oldKey;
    }
  } finally {
    if (id) await getDb().collection("jobs").doc(id).delete();
    if (usageId) await getDb().collection("aiUsage").doc(usageId).delete();
    await auth.deleteUser(outsider.uid);
  }
});
