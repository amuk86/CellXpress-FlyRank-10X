import { HttpError } from './errors.js';
export const STATUSES = ['in_progress', 'ready_for_pickup', 'completed'];
export const PAYMENTS = ['unpaid', 'paid', 'waived'];
function object(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HttpError(400, 'Expected a JSON object.');
}
function text(value, name, max, required = false) {
  if (value === undefined || value === null) value = '';
  if (typeof value !== 'string' || value.trim().length > max || /[\x00-\x08\x0b-\x1f]/.test(value)) throw new HttpError(400, `${name} must be text of at most ${max} characters.`);
  if (required && !value.trim()) throw new HttpError(400, `${name} is required.`);
  return value.trim();
}
function fee(value) {
  if (value === '' || value === null || value === undefined) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1000000 || Math.abs(value * 100 - Math.round(value * 100)) > 0.00001) throw new HttpError(400, 'fee must be a non-negative number with at most two decimals, or null.');
  return value;
}
function keys(value, allowed) {
  if (Object.keys(value).some(k => !allowed.includes(k))) throw new HttpError(400, 'Request contains unsupported fields.');
}
export function validateJob(input) {
  object(input);
  keys(input, ['customerName','deviceModel','customerPhone','faultDescription','fee','diagnosis','workDone','reviewed']);
  if (input.reviewed !== true) throw new HttpError(400, 'Staff review is required before saving.');
  const phone = text(input.customerPhone, 'customerPhone', 24);
  if (phone && !/^(?:0\d{9}|\+[1-9]\d{7,14})$/.test(phone)) throw new HttpError(400, 'Use a 10-digit South African number or international +country number.');
  return {
    customerName: text(input.customerName, 'customerName', 100, true),
    deviceModel: text(input.deviceModel, 'deviceModel', 120, true),
    customerPhone: phone,
    faultDescription: text(input.faultDescription, 'faultDescription', 1000, true),
    fee: fee(input.fee), diagnosis: text(input.diagnosis, 'diagnosis', 2000), workDone: text(input.workDone, 'workDone', 2000),
    reviewed: true,
  };
}
export function validateUpdate(input, current, now = new Date()) {
  object(input);
  keys(input, ['status','paymentStatus','diagnosis','workDone','fee']);
  if (!Object.keys(input).length) throw new HttpError(400, 'Provide a change.');
  if (current.status === 'completed') throw new HttpError(409, 'Collected jobs are read-only.');
  const update = { updatedAt: now };
  if ('fee' in input) update.fee = fee(input.fee);
  for (const key of ['diagnosis','workDone']) if (key in input) update[key] = text(input[key], key, 2000);
  if ('paymentStatus' in input) {
    if (!PAYMENTS.includes(input.paymentStatus)) throw new HttpError(400, 'Invalid paymentStatus.');
    update.paymentStatus = input.paymentStatus;
  }
  const payment = update.paymentStatus || current.paymentStatus || 'unpaid';
  const price = 'fee' in update ? update.fee : current.fee;
  if (payment === 'paid' && price == null) throw new HttpError(409, 'Record a fee before marking payment paid.');
  if ('status' in input) {
    const next = input.status;
    if (!STATUSES.includes(next)) throw new HttpError(400, 'Invalid status.');
    if (next !== current.status && STATUSES.indexOf(next) !== STATUSES.indexOf(current.status) + 1) throw new HttpError(409, 'Advance repairs one stage at a time.');
    if (next === 'ready_for_pickup' && !(update.workDone ?? current.workDone)?.trim()) throw new HttpError(409, 'Record work done before marking repair ready.');
    if (next === 'completed' && !['paid','waived'].includes(payment)) throw new HttpError(409, 'Record payment as paid or waived before collection.');
    update.status = next;
    if (next !== current.status) update[next === 'ready_for_pickup' ? 'readyAt' : 'completedAt'] = now;
  }
  return update;
}
