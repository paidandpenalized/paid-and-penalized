// make refresh's reproduction report for HACRP (pipeline/py/pp_pipeline/refresh.py runs it after make emit), Markdown on
// stdout for the pull request: acceptance A1 on the emitted data, every history year's self-check, and the dollar
// estimates' checks against CMS's published totals. These are the checks the page build stops on, read from the files
// the pages read (loadHacrp, which also stops on a year that doesn't line up). Exits 1 when any fails.
import { checkA1 } from '../../../engine/js/hacrp/acceptance.js';
import { isMain } from '../../../pipeline/files.js';
import { count } from '../../../web/render/format.js';
import { loadHacrp } from '../web/data.js';
import { a1Summary } from '../web/generate.js';
import { historyData } from '../web/history-data.js';

// A check's value for the table: whole numbers as they are, others to six significant digits; a check with nothing to
// divide by has none.
const shownValue = (v) => (v === null ? 'none' : Number.isInteger(v) ? v : Number(v.toPrecision(6)));

// data: loadHacrp()'s result. -> { ok, text }.
export function reproductionReport(data) {
  const { fy, hospitals, model, history, master, dollars, source } = data;
  const a1 = checkA1(hospitals, model);
  const checks = history ? historyData({ history, master }).checks : [];
  const missed = checks.filter((c) => !c.check.ok);
  const failedDollars = dollars.checks.filter((c) => !c.pass);
  const lines = [
    `**HACRP FY${fy}**: CMS's file \`${source.id}\` (released ${source.pdcReleased}), ${count(hospitals.length)} hospitals; `
      + `${count(a1.b.n)} scored with a decision, ${count(a1.b.yes)} of them cut.`,
    '',
    'Acceptance A1 (the page build stops unless it holds):',
    '',
    '```text',
    a1Summary(a1),
    '```',
    '',
    history
      ? `History self-check: ${missed.length ? `${missed.length} of ${checks.length} years FAIL` : `all ${checks.length} years reproduce CMS's totals and decisions`} `
        + `(FY${checks[0].fy}–FY${checks.at(-1).fy})${missed.map((c) => `; FY${c.fy}: largest miss ${c.check.maxError}, ${c.check.wrongSide.length} out of order`).join('')}.`
      : 'History: none in this build.',
    '',
    `Dollar estimates' checks (FY${dollars.fy}, held against CMS's published totals): ${dollars.checks.length - failedDollars.length} of ${dollars.checks.length} pass.`,
    '',
    '| Check | Value | Range | Result |',
    '|---|---|---|---|',
    ...dollars.checks.map((c) => `| \`${c.id}\` | ${shownValue(c.value)} | ${c.low} to ${c.high} | ${c.pass ? 'pass' : '**FAIL**'} |`),
  ];
  return { ok: a1.ok && !missed.length && !failedDollars.length, text: lines.join('\n') };
}

if (isMain(import.meta.url)) {
  let report;
  try {
    report = reproductionReport(loadHacrp());
  } catch (err) {
    report = { ok: false, text: `The HACRP pages' data doesn't load: ${err.message}` };
  }
  console.log(report.text);
  process.exitCode = report.ok ? 0 : 1;
}
