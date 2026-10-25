// Calendar dates as YYYY-MM-DD text: the one rule for what counts as a date, shared by the page formatters
// (web/render/format.js), the corrections naming rule the change gate reads, and the HACRP loader. Pure.
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

// Whether the year, month (1-12) and day exist together on the calendar.
export function onCalendar(year, month, day) {
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

// [year, month, day] of a YYYY-MM-DD text. The shape is checked, not the calendar (isIsoDate checks both).
export function isoParts(text) {
  const m = ISO_DATE.exec(text);
  if (!m) throw new RangeError(`expected YYYY-MM-DD, got "${text}"`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

// Whether text is a YYYY-MM-DD date that exists on the calendar.
export function isIsoDate(text) {
  const m = ISO_DATE.exec(text);
  return m !== null && onCalendar(Number(m[1]), Number(m[2]), Number(m[3]));
}
