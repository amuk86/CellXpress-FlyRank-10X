import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
const labels = {
  in_progress: "In progress",
  ready_for_pickup: "Repair complete / ready for pickup",
  completed: "Collected",
};
// Standard PDF fonts do not support every Unicode glyph. Preserve original facts
// in Firestore; make unsupported characters explicit in this printable rendering.
function printable(value) {
  return String(value).replace(/[^\x20-\x7e\xa0-\xff\n]/g, "?");
}
export function reportFacts(job) {
  const missing = (value) =>
    value === "" || value == null ? "Not recorded" : String(value);
  const date = (value) =>
    value == null ? "Not recorded" : new Date(value).toISOString();
  return [
    ["Job reference", job.id],
    ["Customer", missing(job.customerName)],
    ["Phone", missing(job.customerPhone)],
    ["Device", missing(job.deviceModel)],
    ["Reported fault", missing(job.faultDescription)],
    ["Diagnosis", missing(job.diagnosis)],
    ["Work done", missing(job.workDone)],
    [
      "Fee (ZAR)",
      job.fee == null ? "Not recorded" : Number(job.fee).toFixed(2),
    ],
    ["Repair / collection", labels[job.status] || missing(job.status)],
    ["Payment", missing(job.paymentStatus)],
    ["Created (UTC)", date(job.createdAt)],
    ["Updated (UTC)", date(job.updatedAt)],
    ["Ready (UTC)", date(job.readyAt)],
    ["Collected (UTC)", date(job.completedAt)],
  ];
}
export async function generateReport(job) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page, y;
  function newPage() {
    page = pdf.addPage([595.28, 841.89]);
    y = 785;
    page.drawText("CellXpress | Repair report", {
      x: 46,
      y,
      size: 20,
      font: bold,
      color: rgb(0.13, 0.18, 0.17),
    });
    y -= 32;
  }
  newPage();
  for (const [label, value] of reportFacts(job)) {
    if (y < 100) newPage();
    page.drawText(label, { x: 46, y, size: 10, font: bold });
    y -= 16;
    // Wrap even unbroken input at font-measured boundaries.
    let line = "";
    for (const ch of printable(value) + "\n") {
      if (ch === "\n" || regular.widthOfTextAtSize(line + ch, 11) > 495) {
        if (y < 65) newPage();
        page.drawText(line, { x: 46, y, size: 11, font: regular });
        y -= 15;
        line = "";
      }
      if (ch !== "\n") line += ch;
    }
    if (line) {
      page.drawText(line, { x: 46, y, size: 11, font: regular });
      y -= 15;
    }
    y -= 10;
  }
  for (const [i, p] of pdf.getPages().entries())
    p.drawText(
      `Stored facts only | Unsupported font characters shown as ? | Page ${i + 1}`,
      { x: 46, y: 30, size: 8, font: regular },
    );
  return Buffer.from(await pdf.save());
}
