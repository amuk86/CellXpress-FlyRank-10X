export function waLink(job) {
  if (job.status !== "ready_for_pickup" || !job.customerPhone) return null;
  const number = job.customerPhone.startsWith("0")
    ? "27" + job.customerPhone.slice(1)
    : job.customerPhone.replace(/^\+/, "");
  if (!/^[1-9]\d{7,14}$/.test(number)) return null;
  const price =
    job.paymentStatus === "paid"
      ? "Payment recorded as paid."
      : job.paymentStatus === "waived"
        ? "The repair fee has been waived."
        : job.fee == null
          ? "Please contact us to confirm the fee."
          : `Amount due: R${Number(job.fee).toFixed(2)}.`;
  return `https://wa.me/${number}?text=${encodeURIComponent(`Hi ${job.customerName}, your ${job.deviceModel} is ready for collection at CellXpress (UWC Student Centre). ${price}`)}`;
}
