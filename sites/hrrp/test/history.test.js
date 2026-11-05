// The program page's History Part: the small multiples and the roll call as data (not drawn), the timeline and the data
// windows (drawn), the research findings, and the links and text of the two content files, with hostile entries.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COVID_FYS } from '../web/constants.js';
import { capMarks } from '../web/derive.js';
import { historyFigure, historyPart, timeline, windowsFigure } from '../web/figures/history.js';
import { drawHistory } from '../web/figures/history-draw.js';
import { ROLL, noTotalText, researchData, rollCall, rollText, smallLines, timelineData, windowRows } from '../web/figures/history-data.js';
import { researchPart } from '../web/figures/research.js';
import { httpsUrl } from '../web/links.js';
import { FUTURE_WORDS } from '../../../pipeline/test/helpers.js';
import { META, hospital, loadHrrpOnce } from './fixtures.js';

const cms = (label) => ({ kind: 'CMS', label, url: 'https://example.org/cms' });
const kff = { kind: 'KFF', label: 'KFF estimate', url: 'https://example.org/kff' };
// 2013-2027 national rows: the cap steps 1, 2, 3; FY2016 and FY2024 have no total; FY2022 is KFF's.
const NATIONAL = Array.from({ length: 15 }, (_, i) => {
  const fy = 2013 + i;
  const noTotal = fy === 2016 || fy === 2024;
  return {
    fy, n: 3000 + i, nPen: 2000 + i, pctPen: 60 + i, meanRed: 0.3 + i / 100, meanRedPen: 0.4 + i / 100, nMax: 5, cap: Math.min(3, fy - 2012), perf: [`${fy - 6}-07-01`, `${fy - 3}-06-30`],
    totalEst: noTotal ? null : 100000000 + i, totalSrc: noTotal ? null : fy === 2022 ? kff : cms(`CMS ${fy}`),
  };
});
const HISTORY = { years: NATIONAL.slice(0, -1).map((r) => r.fy), paf: {}, national: NATIONAL };

test('the small multiples: share penalized, the average cut for penalized and for all, in the data\'s years', () => {
  const s = smallLines({ history: HISTORY });
  assert.deepEqual(s.years, NATIONAL.map((r) => r.fy));
  assert.deepEqual(s.share.slice(0, 2), [{ fy: 2013, value: 60 }, { fy: 2014, value: 61 }]);
  assert.ok(Math.abs(s.avgPen[1].value - 0.41) < 1e-9);
  assert.ok(Math.abs(s.avgAll[1].value - 0.31) < 1e-9);
  assert.equal(s.table.length, 15);
  assert.equal(s.table[0].n, 3000);
});

test('the estimated totals carry their source kind; years with none are named in words, not drawn as zero', () => {
  const s = smallLines({ history: HISTORY });
  assert.equal(s.totals.length, 13);
  assert.deepEqual(s.totals.find((r) => r.fy === 2022), { fy: 2022, value: 100000009, kind: 'KFF', label: 'KFF estimate', url: 'https://example.org/kff' });
  assert.equal(s.totals.find((r) => r.fy === 2014).kind, 'CMS');
  assert.deepEqual(s.noTotal, [2016, 2024]);
  assert.equal(s.noTotalText, 'No total for FY2016 and FY2024.');
  assert.equal(s.table.find((r) => r.fy === 2016).total, null);
  assert.equal(noTotalText([]), null);
  assert.equal(noTotalText([2026]), 'No total for FY2026.');
});

test('a total\'s source address that is not https is dropped, the label kept', () => {
  const hostile = { ...HISTORY, national: HISTORY.national.map((r) => (r.fy === 2013 ? { ...r, totalSrc: { kind: 'CMS', label: 'Bad link', url: 'javascript:alert(1)' } } : r)) };
  const total = smallLines({ history: hostile }).totals.find((r) => r.fy === 2013);
  assert.equal(total.url, null);
  assert.equal(total.label, 'Bad link');
});

test('the cap steps come from the data, and the three rule marks and the COVID band are placed on its years', () => {
  const s = smallLines({ history: HISTORY });
  assert.deepEqual(s.caps, capMarks(NATIONAL));
  assert.deepEqual(s.caps.map((c) => [c.fy, c.label]), [[2013, '1% cap'], [2014, '2% cap'], [2015, '3% cap']]);
  assert.deepEqual(s.marks.map((m) => [m.fy, m.key]), [[2019, 'histMarkPeer'], [2023, 'histMarkPn'], [2027, 'histMarkMa']]);
  assert.deepEqual(s.marks.map((m) => m.label), ['Peer groups begin', 'Pneumonia measure paused', 'Medicare Advantage stays counted']);
  assert.deepEqual(s.covid.fys, [2022, 2023, 2024]);
  assert.match(s.covid.note, /^CMS left claims from January 1, 2020 through June 30, 2020 out of the program/);
  const short = smallLines({ history: { ...HISTORY, national: NATIONAL.slice(0, 4) } });
  assert.deepEqual(short.marks.map((m) => m.fy), [], 'a mark outside the data\'s years is not placed');
  assert.deepEqual(short.covid.fys, []);
});

test('the marks\' words carry their claims: peer groups HRRP-05, pneumonia HRRP-17, Medicare Advantage HRRP-14, the COVID note HRRP-18', async () => {
  const { COPY } = await import('../web/program/copy.js');
  assert.equal(COPY.histMarkPeer.claim, 'HRRP-05');
  assert.equal(COPY.histMarkPn.claim, 'HRRP-17');
  assert.equal(COPY.histMarkMa.claim, 'HRRP-14');
  assert.equal(COPY.histCovidNote.claim, 'HRRP-18');
});

test('real data: the history has three marks, a source kind on every total and a COVID band on years whose windows meet early 2020', () => {
  const { history } = loadHrrpOnce();
  const s = smallLines({ history });
  assert.equal(s.marks.length, 3);
  assert.ok(s.totals.every((r) => r.kind === 'CMS' || r.kind === 'KFF'));
  assert.ok(s.totals.every((r) => r.url === null || r.url.startsWith('https://')));
  assert.deepEqual(s.covid.fys, [2022, 2023, 2024]);
  const win = Object.fromEntries(history.national.map((r) => [r.fy, r.perf]));
  for (const fy of COVID_FYS) assert.ok(win[fy][1] >= '2019-12-01' && win[fy][0] <= '2020-06-30', `FY${fy}'s window meets the excluded months`);
  assert.ok(win[2021][1] < '2020-01-01', 'FY2021\'s window ends before them');
  assert.ok(win[2025][0] > '2020-06-30', 'FY2025\'s window starts after them');
});

// ---------- the History figure [HI-09] ----------

const PHONE = 300;
const WIDE = 860;
const svgOf = (lines, width) => drawHistory({ lines, width }).text;
const attr = (markup, name) => [...markup.matchAll(new RegExp(`${name}="([^"]*)"`, 'g'))].map((m) => m[1]);
// The share panel's markup: from its group to the next panel's.
const sharePanelOf = (svg) => svg.slice(svg.indexOf('hist-panel--share'), svg.indexOf('hist-panel--avg'));

test('the figure: each cap step and rule mark is written in words at its own year, on both drawings', () => {
  const lines = smallLines({ history: HISTORY });
  for (const width of [PHONE, WIDE]) {
    const panel = sharePanelOf(svgOf(lines, width));
    const groups = [...panel.matchAll(/<g class="hist-ann" data-fy="(\d+)" data-key="([^"]+)">(.*?)<\/g>/g)];
    assert.deepEqual(groups.map((g) => [Number(g[1]), g[2]]), [[2013, 'cap'], [2014, 'cap'], [2015, 'cap'], [2019, 'histMarkPeer'], [2023, 'histMarkPn'], [2027, 'histMarkMa']]);
    const dotX = Object.fromEntries([...panel.matchAll(/data-fy="(\d+)"[^>]*><title>[^<]*<\/title><circle class="hist-dot--share" cx="([\d.]+)"/g)].map((m) => [m[1], Number(m[2])]));
    for (const [, fy, , body] of groups) {
      const leader = body.match(/<line class="chart-axis__tick" x1="([\d.]+)"/);
      assert.ok(leader, `FY${fy} has a leader`);
      assert.ok(Math.abs(Number(leader[1]) - dotX[fy]) < 0.02, `FY${fy}'s words hang from its own point`);
    }
    const words = groups.map((g) => g[3].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '));
    assert.match(words[3], /Peer groups begin/);
    assert.match(words[4], /Pneumonia\s+measure paused|Pneumonia measure paused|Pneumonia\s+measure\s+paused/);
    assert.match(words[5], /Medicare\s+Advantage\s+stays\s+counted/);
    assert.match(words[0], width === PHONE ? /1%/ : /1% cap/);
  }
});

test('the figure: the axis start is said on the chart when it is not 0, and not when it is', () => {
  const lines = smallLines({ history: HISTORY });
  assert.match(svgOf(lines, PHONE), /AXIS STARTS AT|Axis starts at 40%/i);
  assert.match(sharePanelOf(svgOf(lines, WIDE)), />Axis starts at 40%</);
  const low = { ...HISTORY, national: NATIONAL.map((r) => ({ ...r, pctPen: 5 + (r.fy - 2013), nPen: 100 })) };
  assert.doesNotMatch(svgOf(smallLines({ history: low }), WIDE), /Axis starts at/);
});

test('the figure: the pandemic years are shaded in every panel, with the note on hover, and named on the large panel', () => {
  const svg = svgOf(smallLines({ history: HISTORY }), WIDE);
  assert.equal((svg.match(/class="hist-covid"/g) ?? []).length, 3);
  assert.match(svg, /<title>CMS left claims from January 1, 2020 through June 30, 2020/);
  assert.match(sharePanelOf(svg), />Pandemic years</);
});

test('the figure: totals are CMS dark and KFF light, a source on each bar, and a year with none is a dash, never a bar or a zero', () => {
  const svg = svgOf(smallLines({ history: HISTORY }), WIDE);
  const bars = [...svg.matchAll(/<g class="chart-mark" data-mark data-fy="(\d+)" data-kind="(CMS|KFF)" data-value="([^"]+)"><title>([^<]*)<\/title><rect class="hist-bar hist-bar--(cms|kff)"/g)];
  assert.equal(bars.length, 13);
  const by = Object.fromEntries(bars.map((b) => [b[1], b]));
  assert.equal(by[2022][2], 'KFF');
  assert.equal(by[2022][5], 'kff');
  assert.equal(by[2014][5], 'cms');
  assert.match(by[2022][4], /KFF estimate/);
  assert.match(by[2014][4], /CMS 2014/);
  assert.ok(!by[2016] && !by[2024], 'no bar for a year with no total');
  assert.equal((svg.match(/class="hist-none"/g) ?? []).length, 2);
  assert.match(svg, /FY2016: no published total/);
  assert.ok(!/data-value="0"/.test(svg), 'nothing is plotted as zero');
});

test('the figure: a year with no share draws no dot and breaks the line; no value is drawn as zero', () => {
  const gap = { ...HISTORY, national: NATIONAL.map((r) => (r.fy === 2018 ? { ...r, pctPen: null, meanRed: null, meanRedPen: null } : r)) };
  const lines = smallLines({ history: gap });
  const svg = svgOf(lines, WIDE);
  assert.equal((svg.match(/class="hist-dot--share"/g) ?? []).length, 14);
  assert.ok(!/hist-dot--share" cx="[\d.]+" cy="[\d.]+" r="3"\/><\/g>[^]*FY2018: \d/.test(svg) && !svg.includes('FY2018: 0'));
  const d = [...svg.matchAll(/class="hist-line hist-line--share" d="([^"]*)"/g)][0][1];
  assert.equal((d.match(/[Mm]/g) ?? []).length, 2, 'two strokes around the gap');
  const fig = historyFigure(lines, { n: 1 }).text;
  assert.match(fig, /<th scope="row">FY2018<\/th><td class="num" data-value="3005">3,005<\/td><td class="num">–<\/td>/);
});

test('the figure: frame, takeaway from the latest year, no-total words and the table of every plotted value', () => {
  const lines = smallLines({ history: HISTORY });
  const text = historyFigure(lines, { n: 3 }).text;
  assert.match(text, /74\.0% of hospitals are cut in FY2027\./);
  assert.match(text, /No total for FY2016 and FY2024\./);
  assert.match(text, /fig__swatch--bar-dark/);
  assert.match(text, /fig__swatch--bar-light/);
  assert.match(text, /<th scope="row">FY2016<\/th>[^]*?No total found/);
  assert.match(text, /<th scope="row">FY2022<\/th>[^]*?KFF estimate/);
  assert.equal(historyFigure(smallLines({ history: { ...HISTORY, national: [] } }), { n: 1 }), '');
  assert.match(historyPart({ lines, windows: windowRows({ history: HISTORY }), timeline: [] }, { figure: (() => { let n = 0; return () => ++n; })() }).text, /id="figure-1"[^]*id="figure-2"/);
});

test('the figure: a hostile source label is escaped in the tip and the table', () => {
  const hostile = { ...HISTORY, national: HISTORY.national.map((r) => (r.fy === 2013 ? { ...r, totalSrc: { kind: 'CMS', label: '<img src=x onerror=alert(1)>', url: 'https://example.org/' } } : r)) };
  const text = historyFigure(smallLines({ history: hostile }), { n: 1 }).text;
  assert.ok(!text.includes('<img'), 'no image tag');
  assert.ok(text.includes('&lt;img src=x onerror=alert(1)&gt;'));
});

test('real data: the figure builds at both widths; FY2024 and FY2026 are listed as having no published total; every mark is placed', () => {
  const { history } = loadHrrpOnce();
  const lines = smallLines({ history });
  const fig = historyFigure(lines, { n: 1 }).text;
  assert.match(fig, /No total for FY2024 and FY2026\./);
  assert.match(fig, /80\.2% of hospitals are cut in FY2027\./);
  for (const width of [PHONE, WIDE]) {
    const panel = sharePanelOf(svgOf(lines, width));
    assert.equal((panel.match(/class="hist-ann"/g) ?? []).length, lines.caps.length + lines.marks.length);
    assert.match(panel, /Axis starts at 40%/);
  }
  assert.equal((svgOf(lines, WIDE).match(/hist-bar--/g) ?? []).length, lines.totals.length);
});

test('no raw ISO date reaches the History figure\'s words, tips or table; a year with no all-hospitals average still has a whole tip', () => {
  const real = historyFigure(smallLines({ history: loadHrrpOnce().history }), { n: 1 }).text.replace(/<[^>]*>/g, ' ');
  assert.doesNotMatch(real, /\d{4}-\d{2}-\d{2}/);
  assert.match(real, /January 1, 2020 through June 30, 2020/);
  const part = historyFigure(smallLines({ history: HISTORY }), { n: 1 }).text;
  assert.doesNotMatch(part, /<title>[^<]*\d{4}-\d{2}-\d{2}/);
  const gap = { ...HISTORY, national: HISTORY.national.map((r) => (r.fy === 2018 ? { ...r, meanRed: null } : r)) };
  const svg = svgOf(smallLines({ history: gap }), WIDE);
  assert.match(svg, /FY2018: average cut 0\.45% among penalized hospitals<\/title>/);
  assert.ok(!/among all hospitals<\/title>/.test(svg.replace(/FY\d{4}: average cut [\d.]+% among penalized hospitals, [\d.]+% among all hospitals/g, '')));
  assert.match(part, /hist-note__none">No total for FY2016 and FY2024\./);
});

// ---------- the roll call ----------

const ROLL_HISTORY = { years: [2025, 2026], paf: { 990001: [0.99, 0.98], 990002: [null, 0.99], 990003: [1, 1], 990004: [1, 1], 990005: [0.99, null], 990006: [1, 0.99] }, national: [] };
const ROLL_HOSPITALS = [
  hospital({ id: '990001', paf: 0.97 }), // cut in all three years
  hospital({ id: '990002', paf: 0.99 }), // absent in 2025, then cut twice
  hospital({ id: '990003', paf: 1 }), // never cut
  hospital({ id: '990004', paf: 0.99 }), // not cut, not cut, then cut
  hospital({ id: '990005', paf: 1 }), // cut once, absent, not cut
  hospital({ id: '990006', paf: 1 }), // not cut, cut, not cut
];

test('the roll call: one record for each hospital, one character for each year; absent is blank, never "not cut"', () => {
  const r = rollCall({ hospitals: ROLL_HOSPITALS, history: ROLL_HISTORY, meta: META });
  assert.deepEqual(r.years, [2025, 2026, 2027]);
  const marks = Object.fromEntries(r.records.map((x) => [x.id, x.marks]));
  assert.equal(marks['990001'], 'CCC');
  assert.equal(marks['990002'], ' CC');
  assert.equal(marks['990003'], 'NNN');
  assert.equal(marks['990005'], 'C N');
  assert.equal(marks['990005'].charAt(1), ROLL.absent);
  assert.notEqual(marks['990005'].charAt(1), ROLL.kept);
  assert.ok(r.records.every((x) => x.marks.length === 3));
});

test('the roll call: records ordered by the first year cut, never cut last', () => {
  const r = rollCall({ hospitals: ROLL_HOSPITALS, history: ROLL_HISTORY, meta: META });
  assert.deepEqual(r.records.map((x) => x.id), ['990001', '990005', '990002', '990006', '990004', '990003']);
});

test('the roll call: "cut every year it was in the file" differs from "cut in all N years"; never cut is counted', () => {
  const { counts } = rollCall({ hospitals: ROLL_HOSPITALS, history: ROLL_HISTORY, meta: META });
  assert.equal(counts.n, 6);
  assert.equal(counts.nYears, 3);
  assert.equal(counts.cutAllYears, 1);
  assert.equal(counts.cutEveryYearInFile, 2, '990001, and 990002 which is absent in 2025 but cut in both years it is in the file');
  assert.equal(counts.neverCut, 1);
  assert.equal(counts.everCut, 5);
  assert.deepEqual(counts.byYear.map((y) => [y.fy, y.present, y.cut]), [[2025, 5, 2], [2026, 5, 3], [2027, 6, 3]]);
  assert.equal(counts.byYear[0].share, 2 / 5);
});

test('the roll call\'s words say "of today\'s hospitals"', () => {
  const text = rollText(rollCall({ hospitals: ROLL_HOSPITALS, history: ROLL_HISTORY, meta: META }));
  assert.match(text, /^Of today’s 6 hospitals: 1 never cut; 2 cut in every year they appear in the file; 1 cut in all 3 years\.$/);
});

test('real data: every hospital has a record of one character per year; all-years is fewer than every-year-in-the-file', () => {
  const data = loadHrrpOnce();
  const r = rollCall(data);
  assert.equal(r.records.length, data.hospitals.length);
  assert.ok(r.records.every((x) => x.marks.length === data.history.years.length + 1));
  assert.ok(r.counts.cutAllYears < r.counts.cutEveryYearInFile);
  assert.ok(r.counts.neverCut > 0);
  assert.equal(r.counts.neverCut + r.counts.everCut, data.hospitals.length);
});

// ---------- the timeline ----------

const EDITION = { fy: 2027 };
const ENTRIES = [
  { date: '2010-03-23', fy: null, title: 'Congress creates the program', body: 'It begins.', src: { label: 'Pub. L. 111-148', url: 'https://www.govinfo.gov/x' } },
  { date: '2026-10-01', fy: 2027, title: 'This year', body: 'Now.', src: { label: 'A rule', url: 'https://www.federalregister.gov/y' } },
  { date: '2029-10-01', fy: 2030, title: 'Later year', body: 'Later.', src: { label: 'Another rule', url: 'https://www.federalregister.gov/z' } },
  { date: '2031-01-01', fy: null, title: 'Dated, no year', body: 'Dated.', src: { label: 'A law', url: 'https://www.congress.gov/q' } },
];
const HOSTILE = [
  { date: '2020-01-01', fy: null, title: '<script>alert("t")</script>', body: 'a <b>bold</b> & "quoted" body', src: { label: '<img src=x onerror=alert(1)>', url: 'javascript:alert(1)' } },
  { date: '2020-01-02', fy: null, title: 'Plain http', body: 'b', src: { label: 'Insecure', url: 'http://example.org/page' } },
  { date: '2020-01-03', fy: null, title: 'Quote in url', body: 'c', src: { label: 'Quoted', url: 'https://example.org/" onclick="alert(1)' } },
  { date: '2020-01-04', fy: null, title: 'Data url', body: 'd', src: { label: 'Data', url: 'data:text/html,<script>1</script>' } },
];

test('the timeline: future years are marked (a year past the edition\'s, or a date past the file\'s when there is no year)', () => {
  const data = timelineData(ENTRIES, { edition: EDITION, today: '2026-10-07' });
  assert.deepEqual(data.map((e) => e.future), [false, false, true, true]);
  const text = timeline(data).text;
  assert.equal((text.match(/tl__item--future/g) ?? []).length, 2);
  assert.equal((text.match(/Not yet in effect/g) ?? []).length, 2);
  assert.match(text, /<time datetime="2010-03-23">March 23, 2010<\/time>/);
  assert.match(text, /<a href="https:\/\/www\.govinfo\.gov\/x" target="_blank" rel="noopener">Pub\. L\. 111-148<span class="vh">[^<]*<\/span><\/a>/);
});

test('httpsUrl: only an https address survives', () => {
  assert.equal(httpsUrl('https://example.org/a'), 'https://example.org/a');
  for (const bad of ['javascript:alert(1)', 'http://example.org', 'data:text/html,x', '//example.org', 'ftp://example.org', 'https://user:pw@example.org/', 'https://user@example.org/', '', null, undefined, 'not a url', ' javascript:1']) assert.equal(httpsUrl(bad), null, String(bad));
});

test('the timeline: a hostile entry is escaped and its non-https links are not links', () => {
  const text = timeline(timelineData(HOSTILE, { edition: EDITION, today: '2026-10-07' })).text;
  assert.ok(!text.includes('<script'), 'no script tag');
  assert.ok(!text.includes('<img'), 'no image tag');
  assert.ok(text.includes('&lt;script&gt;alert(&quot;t&quot;)&lt;/script&gt;'));
  assert.ok(text.includes('a &lt;b&gt;bold&lt;/b&gt; &amp; &quot;quoted&quot; body'));
  assert.doesNotMatch(text, /href="javascript/i);
  assert.doesNotMatch(text, /href="http:/i);
  assert.doesNotMatch(text, /href="data:/i);
  assert.doesNotMatch(text, / onclick=/, 'a quote in an address cannot break out of its attribute');
  const hrefs = [...text.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);
  assert.ok(hrefs.every((h) => h.startsWith('https://')), hrefs.join(' '));
  assert.ok(text.includes('Insecure'), 'the label of a dropped link stays as text');
});

test('the real timeline: every link is https and every entry has a date, a title and a source', () => {
  const data = loadHrrpOnce();
  const entries = timelineData(data.timeline, { edition: { fy: data.fy }, today: data.meta.fileDate });
  assert.ok(entries.length > 5);
  assert.ok(entries.every((e) => e.src.url !== null && /^\d{4}-\d{2}-\d{2}$/.test(e.date) && e.title && e.src.label), 'a content link was dropped');
});

test('the real timeline\'s words promise nothing: no future word, no fiscal year past the edition\'s, no "will"', () => {
  const data = loadHrrpOnce();
  for (const e of data.timeline) {
    const text = `${e.title} ${e.body}`;
    assert.doesNotMatch(text, FUTURE_WORDS, e.title);
    assert.doesNotMatch(text, /\bwill\b|\bnext\b|\bstarting\b|\bbeginning in\b/i, e.title);
    for (const [, year] of text.matchAll(/\b(?:FY\s?|fiscal year )(\d{4})\b/gi)) assert.ok(Number(year) <= data.fy, `${e.title}: FY${year} is past the edition`);
    assert.ok(e.fy == null || e.fy <= data.fy, `${e.title}: a future fiscal year`);
    assert.ok(e.date <= data.meta.fileDate, `${e.title}: dated after the file`);
  }
});

// ---------- the data windows ----------

test('the data windows: a row for each fiscal year, newest first, the payment year October to September; a missing window is said', () => {
  const rows = windowRows({ history: { national: [{ fy: 2018, perf: [null, null] }, { fy: 2019, perf: ['2014-07-01', '2017-06-30'] }] } });
  assert.deepEqual(rows.map((r) => r.fy), [2019, 2018]);
  assert.deepEqual(rows[0].pay, ['2018-10-01', '2019-09-30']);
  assert.equal(rows[1].perf, null);
  const text = windowsFigure(rows, { n: 4 }).text;
  assert.match(text, /chart-periods__perf/);
  assert.match(text, /chart-periods__pay/);
  assert.match(text, /<th scope="row">FY2018<\/th><td>not available<\/td><td>October 1, 2017 – September 30, 2018<\/td>/);
  assert.match(text, /The data behind a year’s cut ends months before the cut begins: for FY2019 the data window ends June 30, 2017 and payments change October 1, 2018\./);
  assert.match(text, /id="figure-4"/);
});

test('the History Part holds the small multiples, the windows figure (both numbered from the counter) and the timeline', () => {
  const text = historyPart({ lines: smallLines({ history: HISTORY }), windows: windowRows({ history: HISTORY }), timeline: timelineData(ENTRIES, { edition: EDITION, today: '2026-10-07' }) }, { figure: () => 9 }).text;
  assert.match(text, /id="figure-9"/);
  assert.match(text, /<ol class="tl"/);
  assert.equal((text.match(/<figure /g) ?? []).length, 2);
});

// ---------- the research ----------

const FINDINGS = [
  { theme: 'First question', cite: 'Author A et al., Journal 2016', title: 'A study', url: 'https://doi.org/10.1/a', finding: 'It fell.' },
  { theme: 'Second question', cite: 'Author B, Journal 2017', title: 'Another study', url: 'https://doi.org/10.1/b', finding: 'It rose.' },
  { theme: 'First question', cite: 'Author C, Journal 2018', title: 'A third study', url: 'https://doi.org/10.1/c', finding: 'Disagreed.' },
];

test('the research findings are grouped by theme in the order each appears, each with its cite and link', () => {
  const groups = researchData(FINDINGS);
  assert.deepEqual(groups.map((g) => [g.theme, g.items.length]), [['First question', 2], ['Second question', 1]]);
  const text = researchPart(groups).text;
  assert.equal((text.match(/<h3 /g) ?? []).length, 2);
  assert.match(text, /<div class="rsgrid">/, 'the themes are columns of one grid');
  assert.ok(text.indexOf('Author A') < text.indexOf('Author C') && text.indexOf('Author C') < text.indexOf('Author B'));
  assert.match(text, /<strong>Author A et al\., Journal 2016<\/strong>\. <a href="https:\/\/doi\.org\/10\.1\/a" target="_blank" rel="noopener">A study<span class="vh">[^<]*<\/span><\/a>/);
});

test('research: a hostile entry is escaped and its non-https link is not a link', () => {
  const groups = researchData([
    { theme: '<script>x</script>', cite: '<b>c</b>', title: '<i>t</i>', url: 'javascript:alert(1)', finding: '<script>alert(1)</script> & more' },
    { theme: 'Ok', cite: 'c', title: 'Insecure title', url: 'http://example.org/', finding: 'f' },
  ]);
  assert.equal(groups[0].items[0].url, null);
  assert.equal(groups[1].items[0].url, null);
  const text = researchPart(groups).text;
  assert.ok(!text.includes('<script'));
  assert.ok(!text.includes('<b>c') && !text.includes('<i>t'));
  assert.ok(text.includes('&lt;script&gt;alert(1)&lt;/script&gt; &amp; more'));
  assert.doesNotMatch(text, /href="(javascript|http:)/i);
  assert.ok(text.includes('Insecure title'));
});

test('the real research list: every study links over https', () => {
  const data = loadHrrpOnce();
  const groups = researchData(data.research);
  assert.ok(groups.length >= 3);
  assert.equal(groups.flatMap((g) => g.items).length, data.research.length);
  assert.ok(groups.flatMap((g) => g.items).every((r) => r.url !== null), 'a research link was dropped');
});
