// Calendar dates as YYYY-MM-DD text: the one rule for what counts as a date, shared by the page formatters
// (web/render/format.js), the corrections naming rule the change gate reads, the HACRP loader and the hub's shell facts. Pure.
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

// An emitted file's built_at: UTC, whole seconds (builtAt in schemas/common.schema.json).
const BUILT_AT = /^(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}:\d{2}Z$/;

// The day (YYYY-MM-DD, UTC) of a built_at timestamp, or null when it is not a UTC whole-second timestamp on the
// calendar. The caller says what it was reading.
export function builtOn(builtAt) {
  const day = BUILT_AT.exec(builtAt)?.[1];
  return isIsoDate(day) ? day : null;
}
