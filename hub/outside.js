// The hospitals in Medicare's hospital master that the dollar file does not estimate: the model behind their pages.
// Pure: records in, rows out (no file, network or clock).

// The groups of outside hospitals that share a reason, in the order the pages list them. Each is a reason code in the
// master (pp_engine/master.py), except that the master's `federal` splits by the hospital's kind into `va` and `dod`.
export const LIKE_GROUPS = Object.freeze(['critical_access', 'psychiatric', 'va', 'dod', 'childrens', 'not_listed', 'rural_emergency', 'cancer', 'inactive', 'long_term']);

// The federal hospitals' groups, by the master's kind: Medicare doesn't pay them, so their pages say so and no "instead"
// follows.
export const FEDERAL_GROUPS = new Set(['va', 'dod']);

// The master's program years ({ hacrp, hrrp }: loadHub().programYears, the years its reason codes are for) as the pages'
// copy fills them: { hacrpFy, hrrpFy }, text. Throws a TypeError unless both are integers.
export function yearsOf(programYears) {
  if (!Number.isInteger(programYears?.hacrp) || !Number.isInteger(programYears?.hrrp)) throw new TypeError('outside: programYears needs the master\'s HACRP and HRRP years');
  return { hacrpFy: String(programYears.hacrp), hrrpFy: String(programYears.hrrp) };
}

// A record's group: its HACRP reason code, else its Readmissions one (the first that is not null); `federal` by its kind,
// va or dod. Throws a RangeError naming a code that is not in LIKE_GROUPS, or a federal hospital of another kind.
export function likeGroupOf(record) {
  const code = record.programs.hacrp.reason ?? record.programs.hrrp.reason;
  if (code === 'federal' && !FEDERAL_GROUPS.has(record.kind)) throw new RangeError(`outside: a federal hospital of kind ${JSON.stringify(record.kind)}, neither va nor dod`);
  const group = code === 'federal' ? record.kind : code;
  if (!LIKE_GROUPS.includes(group)) throw new RangeError(`outside: unknown reason code ${JSON.stringify(code)} for a hospital of kind ${JSON.stringify(record.kind)}`);
  return group;
}

// One row for each master record whose CCN is not in dollarCcns, in master order:
//   { ccn, name, city, state, beds, teach, lat, lon, kind, group, reasons: { hacrp, hrrp }, inHrrp, inHacrp, listed, inactive }
// inHrrp: the Readmissions site has a page for it. inHacrp: always false (the HACRP site has pages only for the dollar
// file's hospitals). listed: some program lists the hospital, so it carries no "not in the penalty programs" stamp.
export function outsideHospitals({ master, dollarCcns, hrrp }) {
  const rows = [];
  for (const [ccn, r] of master) {
    if (dollarCcns.has(ccn)) continue;
    const { hacrp: a, hrrp: b } = r.programs;
    rows.push({
      ccn,
      name: r.name,
      city: r.city,
      state: r.state,
      beds: r.beds,
      teach: r.teach,
      lat: r.lat,
      lon: r.lon,
      kind: r.kind,
      group: likeGroupOf(r),
      reasons: { hacrp: a.reason, hrrp: b.reason },
      inHrrp: hrrp.hospitals.has(ccn),
      inHacrp: false,
      listed: Boolean(a.inProgram || b.inProgram),
      inactive: r.inactive,
    });
  }
  return rows;
}

// How many outside hospitals are in each group, how many of them some program's file lists, and how many in each state:
// Map<group, { n, listed, byState: Map<state, n> }>.
export function likeCounts(outside) {
  const counts = new Map();
  for (const h of outside) {
    let g = counts.get(h.group);
    if (!g) counts.set(h.group, (g = { n: 0, listed: 0, byState: new Map() }));
    g.n += 1;
    if (h.listed) g.listed += 1;
    g.byState.set(h.state, (g.byState.get(h.state) ?? 0) + 1);
  }
  return counts;
}
