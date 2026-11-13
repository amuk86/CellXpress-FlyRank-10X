import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { validateJob, validateUpdate } from "../lib/validation.js";
import {
  validateExtraction,
  validateMedia,
  usageMetadata,
} from "../lib/extraction.js";
import { requireStaff, withStaff } from "../lib/auth.js";
import { generateReport, reportFacts } from "../lib/report.js";
import { extractJobDetails } from "../lib/gemini.js";
import { waLink } from "../lib/messages.js";
import jobs from "../pages/api/jobs/index.js";
import single from "../pages/api/jobs/[id]/index.js";
import status from "../pages/api/jobs/[id]/status.js";
import report from "../pages/api/jobs/[id]/report.js";
import extract from "../pages/api/extract.js";
const validJob = {
  customerName: "Demo Customer",
  deviceModel: "Demo Phone",
  faultDescription: "Cracked screen",
  fee: 450,
  reviewed: true,
};
const validAI = () => ({
  customerName: "Demo Customer",
  deviceModel: null,
  fee: 0,
  faultDescription: "Cracked screen",
  confidence: {
    customerName: 0.9,
    deviceModel: 0,
    fee: 0.8,
    faultDescription: 0.8,
  },
  evidence: {
    customerName: "Voice says Demo Customer",
    deviceModel: "",
    fee: "Voice says no charge",
    faultDescription: "Visible crack",
  },
  conflicts: [],
});
function response() {
  return {
    statusCode: 200,
    headers: {},
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
    send(body) {
      this.body = body;
      return this;
    },
  };
}
test("intake requires review and required facts", () => {
  assert.throws(() => validateJob({ ...validJob, reviewed: false }));
  for (const key of ["customerName", "deviceModel", "faultDescription"])
    assert.throws(() => validateJob({ ...validJob, [key]: " " }));
});
test("fees distinguish missing, free, negative, non-finite and coerced strings", () => {
  assert.equal(validateJob({ ...validJob, fee: null }).fee, null);
  assert.equal(validateJob({ ...validJob, fee: 0 }).fee, 0);
  for (const fee of ["450", -1, Infinity, NaN, 1.001, true, {}, 1000001])
    assert.throws(() => validateJob({ ...validJob, fee }));
});
test("intake rejects extra properties, wrong shapes and invalid contact", () => {
  for (const input of [
    null,
    [],
    { ...validJob, status: "completed" },
    { ...validJob, customerName: 123 },
    { ...validJob, customerPhone: "123" },
    { ...validJob, deviceModel: "x".repeat(121) },
  ])
    assert.throws(() => validateJob(input));
  assert.equal(
    validateJob({ ...validJob, customerPhone: "+27820000000" }).customerPhone,
    "+27820000000",
  );
});
test("repair completion requires recorded work and does not record payment", () => {
  assert.throws(() =>
    validateUpdate({ status: "ready_for_pickup" }, { status: "in_progress" }),
  );
  const patch = validateUpdate(
    { status: "ready_for_pickup", workDone: "Screen replaced" },
    { status: "in_progress", paymentStatus: "unpaid" },
  );
  assert.equal(patch.status, "ready_for_pickup");
  assert.equal(patch.paymentStatus, undefined);
  assert.ok(patch.readyAt);
});
test("cannot skip stages, collect unpaid jobs, or mutate collected jobs", () => {
  assert.throws(() =>
    validateUpdate({ status: "completed" }, { status: "in_progress" }),
  );
  assert.throws(() =>
    validateUpdate(
      { status: "completed" },
      { status: "ready_for_pickup", paymentStatus: "unpaid" },
    ),
  );
  assert.throws(() => validateUpdate({ fee: 1 }, { status: "completed" }));
  assert.throws(() =>
    validateUpdate({ status: "made_up" }, { status: "in_progress" }),
  );
});
test("collection accepts explicit paid or waived status and retains timestamps", () => {
  const current = {
    status: "ready_for_pickup",
    paymentStatus: "unpaid",
    fee: 450,
    workDone: "Screen replaced",
  };
  assert.ok(
    validateUpdate({ status: "completed", paymentStatus: "paid" }, current)
      .completedAt,
  );
  assert.ok(
    validateUpdate(
      { status: "completed", paymentStatus: "waived" },
      { ...current, fee: null },
    ).completedAt,
  );
  assert.throws(() =>
    validateUpdate(
      { paymentStatus: "paid" },
      { status: "in_progress", fee: null },
    ),
  );
  assert.equal(
    validateUpdate({ status: "ready_for_pickup" }, current).readyAt,
    undefined,
  );
});
test("staff guard rejects missing, malformed, expired, revoked and non-staff tokens", async () => {
  for (const authorization of [undefined, "Basic abc", "Bearer a b"])
    await assert.rejects(requireStaff({ headers: { authorization } }), {
      status: 401,
    });
  for (const code of [
    "auth/id-token-expired",
    "auth/id-token-revoked",
    "auth/argument-error",
  ])
    await assert.rejects(
      requireStaff({ headers: { authorization: "Bearer abc" } }, async () => {
        throw Object.assign(new Error(), { code });
      }),
      { status: 401 },
    );
  await assert.rejects(
    requireStaff({ headers: { authorization: "Bearer abc" } }, async () => ({
      uid: "x",
      staff: false,
    })),
    { status: 403 },
  );
  assert.equal(
    (
      await requireStaff(
        { headers: { authorization: "Bearer abc" } },
        async () => ({ uid: "x", staff: true }),
      )
    ).uid,
    "x",
  );
});
test("every real API route rejects anonymous access before database or AI work", async () => {
  for (const [handler, method] of [
    [jobs, "GET"],
    [jobs, "POST"],
    [single, "GET"],
    [status, "PATCH"],
    [report, "GET"],
    [extract, "POST"],
  ]) {
    const res = response();
    await handler(
      { method, headers: {}, query: { id: "demo" }, body: validJob },
      res,
    );
    assert.equal(res.statusCode, 401);
    assert.equal(res.headers["Cache-Control"], "no-store");
  }
});
test("staff wrapper invokes authorized handler and sanitizes infrastructure errors", async () => {
  let called = false;
  const res = response();
  await withStaff(
    (req, res) => {
      called = req.staff.uid === "demo";
      res.json({ ok: true });
    },
    async () => ({ uid: "demo", staff: true }),
  )({ headers: {} }, res);
  assert.ok(called);
  const errRes = response();
  await withStaff(
    () => {
      throw new Error("PRIVATE_KEY secret");
    },
    async () => ({ uid: "demo" }),
  )({}, errRes);
  assert.equal(errRes.statusCode, 500);
  assert.doesNotMatch(errRes.body.error, /PRIVATE_KEY/);
});
test("extraction preserves missing values and zero fee, flags uncertainty/conflict", () => {
  const ai = validAI();
  ai.confidence.customerName = 0.2;
  ai.conflicts = ["Two different models stated"];
  const parsed = validateExtraction(ai);
  assert.equal(parsed.fee, 0);
  assert.equal(parsed.deviceModel, null);
  assert.equal(parsed.reviewRequired, true);
  assert.ok(parsed.warnings.some((x) => x.startsWith("Missing")));
  assert.ok(parsed.warnings.some((x) => x.startsWith("Low")));
  assert.ok(parsed.warnings.some((x) => x.startsWith("Conflict")));
});
test("malformed AI output and unsupported facts fail safely", () => {
  for (const mutate of [
    (v) => ({ ...v, fee: "450" }),
    (v) => ({ ...v, fee: -10 }),
    (v) => ({ ...v, customerName: "x".repeat(101) }),
    (v) => ({ ...v, evidence: { ...v.evidence, customerName: "" } }),
    (v) => ({ ...v, confidence: { ...v.confidence, fee: 2 } }),
    (v) => ({ ...v, confidence: { ...v.confidence, deviceModel: 1 } }),
    (v) => ({ ...v, status: "completed" }),
    (v) => ({ ...v, conflicts: [42] }),
  ])
    assert.throws(() => validateExtraction(mutate(validAI())), { status: 502 });
  for (const value of [null, [], {}])
    assert.throws(() => validateExtraction(value), { status: 502 });
});
test("media validation rejects empty, malformed, oversized and unsupported input", () => {
  for (const v of [
    {},
    { audioBase64: "???", audioMimeType: "audio/webm" },
    { imageBase64: "YQ==", imageMimeType: "text/html" },
    [],
  ])
    assert.throws(() => validateMedia(v), { status: 400 });
  assert.throws(
    () =>
      validateMedia({
        imageBase64: "a".repeat(3800004),
        imageMimeType: "image/png",
      }),
    { status: 413 },
  );
  assert.equal(
    validateMedia({ imageBase64: "YQ==", imageMimeType: "image/png" }).length,
    1,
  );
});
test("usage is unknown without pricing, explicit estimates include thinking tokens", () => {
  const counts = {
    promptTokenCount: 100,
    candidatesTokenCount: 20,
    thoughtsTokenCount: 5,
    totalTokenCount: 125,
  };
  assert.equal(usageMetadata(counts, "test", {}).estimatedCostUsd, null);
  const result = usageMetadata(counts, "test", {
    GEMINI_INPUT_USD_PER_MILLION: "1",
    GEMINI_OUTPUT_USD_PER_MILLION: "2",
    GEMINI_PRICING_NOTE: "Test-only rates",
  });
  assert.equal(result.estimatedCostUsd, 0.00015);
  assert.equal(usageMetadata({}, "test", {}).inputTokens, null);
  assert.equal(
    usageMetadata(counts, "test", {
      GEMINI_INPUT_USD_PER_MILLION: "",
      GEMINI_OUTPUT_USD_PER_MILLION: "0",
    }).estimatedCostUsd,
    null,
  );
});
test("Gemini calls are mocked; success uses structured output without credentials in URL", async () => {
  const old = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "test-only-key";
  try {
    const result = await extractJobDetails(
      { imageBase64: "YQ==", imageMimeType: "image/png" },
      async (url, options) => {
        assert.doesNotMatch(url, /test-only-key/);
        const body = JSON.parse(options.body);
        assert.equal(
          body.generationConfig.responseMimeType,
          "application/json",
        );
        return {
          ok: true,
          json: async () => ({
            candidates: [
              {
                finishReason: "STOP",
                content: { parts: [{ text: JSON.stringify(validAI()) }] },
              },
            ],
            usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 },
          }),
        };
      },
    );
    assert.equal(result.extracted.customerName, "Demo Customer");
    assert.equal(result.usage.inputTokens, 10);
  } finally {
    if (old === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = old;
  }
});
test("Gemini handles malformed, blocked, quota and network responses", async () => {
  const old = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "test-only-key";
  const input = { audioBase64: "YQ==", audioMimeType: "audio/webm" };
  try {
    for (const candidate of [
      { finishReason: "STOP", content: { parts: [{ text: "bad json" }] } },
      { finishReason: "MAX_TOKENS" },
      { finishReason: "STOP", content: { parts: [{ text: "{}" }] } },
    ]) {
      const result = await extractJobDetails(input, async () => ({
        ok: true,
        json: async () => ({
          candidates: [candidate],
          usageMetadata: { promptTokenCount: 10 },
        }),
      }));
      assert.equal(result.error.status, 502);
      assert.equal(result.usage.inputTokens, 10);
    }
    await assert.rejects(
      extractJobDetails(input, async () => ({ ok: false, status: 429 })),
      { status: 429 },
    );
    await assert.rejects(
      extractJobDetails(input, async () => {
        throw new Error("private provider detail");
      }),
      { status: 502 },
    );
  } finally {
    if (old === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = old;
  }
});
test("PDF facts retain missing data and zero fee accurately", async () => {
  const job = {
    ...validJob,
    id: "demo-report",
    status: "in_progress",
    paymentStatus: "unpaid",
    fee: 0,
    createdAt: 0,
  };
  const facts = Object.fromEntries(reportFacts(job));
  assert.equal(facts["Fee (ZAR)"], "0.00");
  assert.equal(facts["Diagnosis"], "Not recorded");
  assert.equal(facts["Created (UTC)"], "1970-01-01T00:00:00.000Z");
  const bytes = await generateReport(job);
  assert.equal(bytes.subarray(0, 5).toString(), "%PDF-");
  const pdf = await PDFDocument.load(bytes);
  assert.equal(pdf.getPageCount(), 1);
});
test("PDF handles long and non-Latin text without crashing", async () => {
  const bytes = await generateReport({
    ...validJob,
    id: "demo-long",
    workDone: "修理🙂 " + "long work ".repeat(1000),
  });
  assert.ok((await PDFDocument.load(bytes)).getPageCount() > 1);
});
test("prepared messages respect payment, unknown fee, phone format and ready status", () => {
  const job = {
    ...validJob,
    customerPhone: "0820000000",
    status: "ready_for_pickup",
    paymentStatus: "paid",
  };
  assert.match(waLink(job), /^https:\/\/wa.me\/27820000000/);
  assert.match(decodeURIComponent(waLink(job)), /Payment recorded as paid/);
  assert.doesNotMatch(decodeURIComponent(waLink(job)), /Amount due/);
  assert.equal(waLink({ ...job, status: "in_progress" }), null);
  assert.equal(waLink({ ...job, customerPhone: "" }), null);
  assert.match(
    decodeURIComponent(waLink({ ...job, fee: null, paymentStatus: "unpaid" })),
    /confirm the fee/,
  );
  assert.match(
    waLink({ ...job, customerPhone: "+447700900123" }),
    /wa.me\/447700900123/,
  );
});
