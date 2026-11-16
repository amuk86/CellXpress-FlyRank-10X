import { useRef, useState, useEffect } from "react";
import Header from "../components/Header.js";
import { useAuth } from "../components/AuthProvider.js";
import { useRouter } from "next/router";
import { safeJson } from "../lib/apiResponse.js";

const CONFIDENCE_THRESHOLD = 0.6;

// Vercel's serverless functions enforce a hard ~4.5MB request body limit that
// can't be raised from app code, so a raw phone photo (often 3-8MB) plus a
// voice note can blow past it once base64-encoded (~33% larger again).
// We resize + recompress the photo client-side before sending anything.
function compressImage(file, maxDimension = 1280, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      let { width, height } = img;
      if (width > height && width > maxDimension) {
        height = Math.round((height * maxDimension) / width);
        width = maxDimension;
      } else if (height > maxDimension) {
        width = Math.round((width * maxDimension) / height);
        height = maxDimension;
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(objectUrl);
      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error("Could not compress photo."));
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result.split(",")[1]);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        },
        "image/jpeg",
        quality,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not read the photo. Try a JPEG or PNG."));
    };
    img.src = objectUrl;
  });
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function ConfidenceBadge({ score }) {
  if (score === undefined || score === null) return null;
  const pct = Math.round(score * 100);
  const level = score >= CONFIDENCE_THRESHOLD ? "green" : "red";
  return <span className={`badge ${level}`}>{pct}% confident</span>;
}

export default function Intake() {
  const router = useRouter();
  const { apiFetch } = useAuth();
  const [reviewed, setReviewed] = useState(false);
  const [warnings, setWarnings] = useState([]);
  const [usage, setUsage] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [fields, setFields] = useState({
    customerName: "",
    deviceModel: "",
    fee: "",
    faultDescription: "",
    customerPhone: "",
    diagnosis: "",
    workDone: "",
  });
  const [confidence, setConfidence] = useState({});

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  useEffect(
    () => () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    },
    [photoPreview],
  );
  useEffect(
    () => () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    },
    [audioUrl],
  );
  useEffect(
    () => () => {
      clearTimeout(recordingTimerRef.current);
      const recorder = mediaRecorderRef.current;
      if (recorder) recorder.onstop = null;
      if (recorder && recorder.state !== "inactive") recorder.stop();
      recorder?.stream.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  const onPhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const startRecording = async () => {
    let stream;
    try {
      if (
        !navigator.mediaDevices?.getUserMedia ||
        typeof MediaRecorder === "undefined"
      )
        throw new Error(
          "Recording is unavailable. Use a supported browser on localhost or HTTPS, or enter details manually.",
        );
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // 32kbps is plenty for a short spoken voice note and keeps the file
      // small enough to stay well under Vercel's serverless request body limit.
      const recorder = new MediaRecorder(stream, { audioBitsPerSecond: 32000 });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = () => {
        clearTimeout(recordingTimerRef.current);
        setRecording(false);
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
      recordingTimerRef.current = setTimeout(() => {
        if (recorder.state === "recording") recorder.stop();
      }, 60000);
    } catch (err) {
      stream?.getTracks().forEach((track) => track.stop());
      setExtractError(err.message);
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  const runExtraction = async () => {
    if (!photoFile && !audioBlob) {
      setExtractError("Add a photo and/or record a voice note first.");
      return;
    }
    setExtracting(true);
    setReviewed(false);
    setExtractError("");
    try {
      const payload = {};
      if (photoFile) {
        payload.imageBase64 = await compressImage(photoFile);
        payload.imageMimeType = "image/jpeg"; // compressImage always re-encodes to JPEG
      }
      if (audioBlob) {
        payload.audioBase64 = await blobToBase64(audioBlob);
        payload.audioMimeType = audioBlob.type.split(";")[0];
      }

      if (JSON.stringify(payload).length > 3800000)
        throw new Error(
          "Media is too large. Use a smaller photo or a shorter recording.",
        );
      const res = await apiFetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.error || "Extraction failed.");

      setFields((prev) => ({
        ...prev,
        customerName: data.customerName || "",
        deviceModel: data.deviceModel || "",
        fee: data.fee ?? "",
        faultDescription: data.faultDescription || "",
      }));
      setConfidence(data.confidence || {});
      setWarnings(data.warnings || []);
      setUsage(data.usage || null);
      setReviewed(false);
    } catch (err) {
      setExtractError(err.message);
    } finally {
      setExtracting(false);
    }
  };

  const updateField = (name, value) => {
    setFields((prev) => ({ ...prev, [name]: value }));
    setReviewed(false);
  };

  const submitJob = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await apiFetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...fields,
          fee: fields.fee === "" ? null : Number(fields.fee),
          reviewed,
        }),
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.error || "Could not save job.");
      router.push("/");
    } catch (err) {
      setExtractError(err.message);
      setSubmitting(false);
    }
  };

  const hasLowConfidence = Object.values(confidence).some(
    (v) => v < CONFIDENCE_THRESHOLD,
  );

  return (
    <div className="page">
      <Header />
      <div className="page-heading">
        <div>
          <div className="eyebrow">NEW REPAIR / STAFF INTAKE</div>
          <h1>A good repair starts here.</h1>
          <p className="muted">
            Capture a photo and voice note, or enter the details manually.
          </p>
        </div>
      </div>
      <div className="intake-layout">
        <section className="intake-panel">
          <div className="eyebrow">01 / OPTIONAL ASSISTANCE</div>
          <h2>Let AI prepare the first draft.</h2>

          <div className="field">
            <label>Photo of device</label>
            <label className="photo-drop">
              {photoPreview ? (
                <img
                  className="photo-preview"
                  src={photoPreview}
                  alt="Device preview"
                />
              ) : (
                "Tap to take or choose a photo"
              )}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={onPhotoChange}
                style={{ display: "none" }}
              />
            </label>
          </div>

          <div className="field">
            <label>Voice note (name, device, fee)</label>
            <div className="record-row">
              {!recording ? (
                <button type="button" className="btn" onClick={startRecording}>
                  ● Record
                </button>
              ) : (
                <button
                  type="button"
                  className="btn secondary"
                  onClick={stopRecording}
                >
                  <span
                    className="record-dot"
                    style={{ display: "inline-block", marginRight: 6 }}
                  />
                  Stop
                </button>
              )}
              {audioUrl && <audio controls src={audioUrl} />}
            </div>
          </div>

          <button
            type="button"
            className="btn"
            onClick={runExtraction}
            disabled={extracting || recording}
          >
            {extracting ? "Listening & reading…" : "Extract job details"}
          </button>

          {extractError && (
            <p className="status-line error" role="alert">
              {extractError}
            </p>
          )}

          {warnings.map((warning, i) => (
            <p className="status-line" key={i}>
              {warning}
            </p>
          ))}
          {usage && (
            <p className="status-line">
              Model: {usage.model} · Estimated USD:{" "}
              {usage.estimatedCostUsd ?? "not configured"}
            </p>
          )}
          <p className="muted">
            Media is sent to Gemini for extraction. Only reviewed job details
            and usage metadata are stored. AI can make mistakes. Double-check
            all extracted details before saving.
          </p>
        </section>
        <section className="intake-panel">
          <div className="eyebrow">02 / STAFF REVIEW</div>
          <h2>Confirm the repair details.</h2>

          <form onSubmit={submitJob}>
            <div className="field">
              <label htmlFor="customerName">Customer name</label>
              <input
                type="text"
                id="customerName"
                maxLength={100}
                value={fields.customerName}
                onChange={(e) => updateField("customerName", e.target.value)}
                required
              />
              <div className="confidence-row">
                <ConfidenceBadge score={confidence.customerName} />
              </div>
            </div>

            <div className="field">
              <label htmlFor="deviceModel">Device model</label>
              <input
                type="text"
                id="deviceModel"
                maxLength={120}
                value={fields.deviceModel}
                onChange={(e) => updateField("deviceModel", e.target.value)}
                required
              />
              <div className="confidence-row">
                <ConfidenceBadge score={confidence.deviceModel} />
              </div>
            </div>

            <div className="field">
              <label htmlFor="fee">Fee (ZAR, leave blank if unknown)</label>
              <input
                type="number"
                min="0"
                max="1000000"
                step="0.01"
                id="fee"
                value={fields.fee}
                onChange={(e) => updateField("fee", e.target.value)}
              />
              <div className="confidence-row">
                <ConfidenceBadge score={confidence.fee} />
              </div>
            </div>

            <div className="field">
              <label htmlFor="fault">Fault description</label>
              <textarea
                id="fault"
                required
                maxLength={1000}
                value={fields.faultDescription}
                onChange={(e) =>
                  updateField("faultDescription", e.target.value)
                }
              />
            </div>

            <div className="field">
              <label htmlFor="phone">
                Customer WhatsApp number (optional, entered by staff)
              </label>
              <input
                type="text"
                id="phone"
                maxLength={24}
                placeholder="e.g. 0821234567 or +27821234567"
                value={fields.customerPhone}
                onChange={(e) => updateField("customerPhone", e.target.value)}
              />
            </div>

            {hasLowConfidence && (
              <p className="status-line error">
                One or more fields were low-confidence — please check them
                before saving.
              </p>
            )}

            <label className="review-check">
              <input
                type="checkbox"
                checked={reviewed}
                onChange={(e) => setReviewed(e.target.checked)}
                required
              />
              <span>
                I have checked the customer, device, fault and fee against the
                source information.
              </span>
            </label>
            <button
              className="btn"
              type="submit"
              disabled={submitting || !reviewed || extracting || recording}
            >
              {submitting ? "Saving…" : "Save job to board"}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
