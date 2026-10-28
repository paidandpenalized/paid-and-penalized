// The hospital page's figures (hospital-figures.js) on synthetic hospitals and pinned rows picked by property: the
// numbers each draws are CMS's (or this site's arithmetic on them, checked against CMS's), every plotted value is in
// its table (figure() checks), and every number in a takeaway comes from the data.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MEASURE_IDS } from '../../../engine/js/hacrp/measures.js';
import { SHORT_NAMES } from '../web/constants.js';
import { ledgerFigure, lineBarBlock, milesText, nearbyBlock, peersFigure, peersPosition, sumFigure, worksheet } from '../web/hospital-figures.js';
import { hospitalPage } from '../web/pages/hospital.js';
import { hospitalView } from '../web/view.js';
import { ASSETS, CASES, esc, hospital, inputs, master, measured } from './fixtures.js';
import { DATA, NAT, PAGE_CTX, RANGE } from './pinned.js';

const { model, estimate } = DATA;
const pinnedView = (h) => hospitalView({ hospital: h, model, estimate, footnotes: DATA.footnotes, master: DATA.master.get(h.ccn), fy: DATA.fy, periods: DATA.periods, boundaryText: DATA.boundaryText });
const pick = (pred, what) => {
  const h = DATA.hospitals.find(pred);
  assert.ok(h, `no pinned row: ${what}`);
  return h;
};
const num = (text) => Number(text.replace('−', '-'));
const captions = (text) => [...text.matchAll(/<figcaption class="fig__cap" id="figure-(\d+)-cap"><span class="fig__n">Figure \d+\.<\/span> ([^<]*)<\/figcaption>/g)].map((m) => [m[1], m[2]]);
const numbers = (s) => Object.values(SHORT_NAMES).reduce((x, name) => x.replaceAll(name, ''), s.replaceAll('&#39;', "'")).match(/[−+]?\d+(,\d{3})*(\.\d+)?%?/g) ?? [];
const render = (h, extra = {}) => hospitalPage({
  ...PAGE_CTX, view: hospitalView(inputs(h)), source: DATA.source, robots: null, assets: ASSETS,
  whatif: h.total === null ? null : { hospital: h, model, estimate, range: RANGE }, ...extra,
});

test('the worksheet adds CMS\'s own z-scores; for every scored hospital the sum over the count is CMS\'s score, or within rounding and said so', () => {
  let noted = 0;
  for (const h of DATA.hospitals.filter((x) => x.total !== null)) {
    const view = pinnedView(h);
    const ws = String(worksheet(view));
    const terms = view.measures.filter((m) => m.hasZ);
    const sum = terms.reduce((s, m) => s + num(m.zText), 0) / terms.length;
    assert.ok(Math.abs(sum - h.total) <= 0.0002, `${h.ccn}: ${sum} vs ${h.total}`);
    assert.ok(ws.includes(`<span class="ws__v">${view.score.text}</span>`), `${h.ccn}: CMS's score`);
    assert.ok(ws.includes(`<span class="ws__v">${terms.length}</span>`), `${h.ccn}: the count`);
    if (/rounded z.scores/.test(ws)) noted++;
  }
  assert.ok(noted > 0, 'some hospitals carry the rounding note');
  assert.equal(worksheet(hospitalView(inputs(CASES.noScore))), null);
});

test('the waterfall: one bar per scored measure, the running total in its table, the last equal to the sum of the shown parts', () => {
  const view = hospitalView(inputs(CASES.assignedLargest));
  const fig = String(sumFigure({ view, n: 2, source: 's' }));
  const parts = view.measures.filter((m) => m.contribution !== null);
  assert.equal((fig.match(/class="chart-step( |")/g) ?? []).length + (fig.match(/chart-step--(down|pen|na)/g) ?? []).length >= parts.length, true);
  assert.match(fig, /chart-step chart-step--na" fill="url\(#chart-sum-hatch\)"/, 'the assigned part keeps its hatch');
  const running = parts.reduce((s, m) => s + m.contributionRaw, 0);
  assert.ok(fig.includes(`>${view.score.text}</text>`), 'the total');
  assert.ok(Math.abs(running - Number(view.score.raw)) < 0.001);
  assert.match(fig, /The parts add up to 0\.3250, above CMS’s line\./);
  assert.equal(sumFigure({ view: hospitalView(inputs(CASES.noScore)), n: 2, source: 's' }), null);
});

test('the ledger: each row CMS\'s value and z-score, its rank among every hospital with a value, an assigned measure a hollow mark at the worst end', () => {
  const view = hospitalView(inputs(CASES.assignedLargest));
  const fig = String(ledgerFigure({ view, nat: NAT, model, n: 1, source: 's', notes: () => '' }));
  for (const m of view.measures.filter((x) => x.hasValue)) {
    const r = NAT.measureRank(m.id, Number(m.valueRaw));
    const median = model.params[m.id].median;
    assert.ok(fig.includes(`<span class="cms">${m.valueText}</span>`), m.id);
    assert.ok(/(Worse|Better) than \d+% of the other [\d,]+ hospitals|At the national median/.test(fig), m.id);
    assert.ok(r.n > 0 && median > 0);
  }
  const ssi = /<li class="ledger__row[^"]*is-assigned">[\s\S]*?<\/li>/.exec(fig)[0];
  assert.match(ssi, /<path class="chart-hyp"/, 'a hollow ▲');
  assert.match(ssi, /no value: CMS assigned the worst score/);
  // Two drawings of each ruler, hidden from screen readers (the row's words say the same).
  assert.equal((fig.match(/<svg aria-hidden="true" data-fit="(narrow|wide)" class="chart chart--ruler"/g) ?? []).length, 12);
});

test('the line bar: none without a score; the rank counts the scores below this one', () => {
  assert.equal(lineBarBlock(hospitalView(inputs(CASES.noScore)), NAT), null);
  const h = pick((x) => x.paymentReduction === 'Yes' && x.total !== null, 'a cut hospital');
  const block = String(lineBarBlock(pinnedView(h), NAT));
  const r = NAT.rankOf(h.total);
  const share = Math.round((100 * r.below) / (r.n - 1));
  assert.ok(block.includes(`Higher than ${share}% of the other ${(r.n - 1).toLocaleString('en-US')} scores CMS published (higher is worse).`), block.slice(-200));
});

test('among hospitals like it: each group\'s share cut is its counts\', the table holds every plotted median, and the takeaway names the lowest and highest share', () => {
  const h = pick((x) => x.paymentReduction === 'Yes' && x.total !== null && DATA.master.get(x.ccn).teach && DATA.master.get(x.ccn).own === 'Nonprofit', 'a cut nonprofit with a teaching status');
  const view = pinnedView(h);
  const { fig, rows } = peersFigure({ view, nat: NAT, master: DATA.master.get(h.ccn), n: 4, source: 's' });
  const text = String(fig);
  for (const r of rows) {
    assert.equal(r.share, `${Math.round((100 * r.g.yes) / r.g.decided)}%`, r.label);
    assert.ok(text.includes(esc(r.label)), r.label);
  }
  const [, takeaway] = /<span class="fig__n">Figure 4\.<\/span> ([^<]*)</.exec(text);
  const allowed = new Set([...rows.map((r) => r.share), String(rows.length), String(rows.filter((r) => h.total > r.g.median).length)]);
  for (const x of numbers(takeaway)) assert.ok(allowed.has(x), `"${x}" in "${takeaway}"`);
  assert.equal(peersFigure({ view: hospitalView(inputs(CASES.yes)), nat: NAT, master: master('990001'), n: 4, source: 's' }), null, 'no groups: no figure');
});

test('the nearest hospitals: a numbered map and table, each hospital linked to its page, its decision as a pill', () => {
  const h = pick((x) => x.total !== null && Number.isFinite(DATA.master.get(x.ccn).lat), 'a scored hospital with a place');
  const view = pinnedView(h);
  const block = nearbyBlock({ view, nat: NAT, shapes: DATA.shapes, counties: DATA.counties, n: 5, source: 's' });
  const table = String(block.table);
  const near = NAT.nearest(h.ccn, view.point);
  near.forEach((x, i) => {
    assert.ok(table.includes(`<span class="near__n">${i + 1}</span>`));
    assert.ok(table.includes(`href="/hacrp/hospital/${x.ccn.toLowerCase()}/"`), x.ccn);
  });
  assert.equal((String(block.fig).match(/class="chart-pin /g) ?? []).length, near.length);
  assert.match(String(block.fig), /<path class="chart-ring"/, 'distance rings');
  assert.equal(nearbyBlock({ view: { ...view, point: null }, nat: NAT, shapes: DATA.shapes, n: 5, source: 's' }), null);
});

test('a pinned page carries every figure in order, and no takeaway holds a number the data didn\'t give', () => {
  for (const [pred, what] of [[(x) => x.paymentReduction === 'Yes' && x.total !== null, 'cut'], [(x) => x.paymentReduction === 'No' && x.total !== null, 'not cut'], [(x) => x.paymentReduction === 'N/A', 'Maryland']]) {
    const h = pick((x) => pred(x) && Number.isFinite(DATA.master.get(x.ccn).lat), what);
    const view = pinnedView(h);
    const text = hospitalPage({ ...PAGE_CTX, view, hospital: h, master: DATA.master.get(h.ccn), source: DATA.source, robots: null, assets: ASSETS, shapes: DATA.shapes, counties: DATA.counties, whatif: { hospital: h, model, estimate, range: RANGE } });
    const caps = captions(text);
    assert.deepEqual(caps.map(([n]) => n), caps.map((_, i) => String(i + 1)), `${what}: numbered in order`);
    assert.ok(caps.length >= 4, `${what}: ${caps.length} figures`);
    for (const id of ['measures', 'sum', 'whatif', 'peers', 'nearby']) assert.ok(text.includes(`id="${id}"`), `${what}: ${id}`);
    const valued = view.measures.filter((m) => m.hasValue && !m.assigned);
    const allowed = new Set([view.score.text, view.largest?.contributionText, String(view.n), String(valued.length), ...Array.from({ length: 101 }, (_, i) => `${i}%`), ...Array.from({ length: 10 }, (_, i) => String(i))]);
    for (const [, takeaway] of caps.slice(0, 2)) for (const x of numbers(takeaway)) assert.ok(allowed.has(x), `${what}: "${x}" in "${takeaway}"`);
  }
});

test('hostile names stay text in every new figure', () => {
  const name = '<img src=x onerror=alert(1)> & "Sons"';
  const text = render(CASES.yes, { view: hospitalView(inputs(CASES.yes, { master: master(CASES.yes.ccn, { name }) })) });
  assert.ok(!text.includes('<img src=x'));
  assert.ok(MEASURE_IDS.length === 6);
});

// ---------- M1 code review: each finding reproduced ----------

test('review: a Maryland page says its hospitals are scored but not subject to the reduction', () => {
  const verdict = /<section class="hosp__verdict"[\s\S]*?<\/section>/.exec(render(CASES.maryland))[0];
  assert.ok(verdict.includes(esc('Maryland’s hospitals are scored but not subject to the reduction.')));
  assert.ok(!/<section class="hosp__verdict"[\s\S]*?<\/section>/.exec(render(CASES.yes))[0].includes('Maryland'));
});

test('review: the no-lever sentence speaks only of the measures CMS scored (a value with no z-score is not one)', () => {
  const h = hospital('990050', {
    total: '-0.5000', decision: 'No',
    measures: { PSI90: measured('0.9000', '-0.5000'), CLABSI: { value: '2.000', valueFootnote: '', z: 'N/A', zFootnote: '5' } },
  });
  const text = render(h, { hospital: h });
  assert.doesNotMatch(text, /None of its measured values/);
  assert.match(text, /None of the measures CMS scored it on is above the national median/);
});

test('review: every rank counts the other hospitals, never more than all of them', () => {
  const r = NAT.rankOf(NAT.domain[1]);
  const block = String(lineBarBlock(pinnedView(DATA.hospitals.find((x) => x.total === NAT.domain[1])), NAT));
  assert.ok(block.includes(`Higher than 100% of the other ${(r.n - 1).toLocaleString('en-US')} scores CMS published`), block.slice(-160));
  const h = DATA.hospitals.find((x) => x.paymentReduction === 'Yes' && x.total !== null);
  const ledger = String(ledgerFigure({ view: pinnedView(h), nat: NAT, model, n: 1, source: 's', notes: () => '' }));
  for (const [, share, n] of ledger.matchAll(/(?:Worse|Better) than (\d+)% of the other ([\d,]+) hospitals/g)) assert.ok(Number(share) <= 100 && Number(n.replace(',', '')) > 0);
  assert.doesNotMatch(ledger, /(?:Worse|Better) than \d+% of [\d,]+ hospitals/);
});

test('review: figures are numbered in order with no gaps, whichever figures a page has', () => {
  const text = render(CASES.allAssigned);
  const nums = captions(text).map(([n]) => Number(n));
  assert.deepEqual(nums, nums.map((_, i) => i + 1));
});

test('review: when every group has the same share cut, the takeaway says so once', () => {
  const view = hospitalView(inputs(CASES.yes));
  const same = { ...NAT, groupsOf: () => ['nation', 'state'].map((kind) => ({ kind, key: kind === 'state' ? 'AL' : 'all', scored: 10, decided: 10, yes: 0, median: 0, scores: [], bins: NAT.groupsOf(DATA.hospitals[0].ccn)[0].bins, below: 5, above: 4 })) };
  const [, takeaway] = /<span class="fig__n">Figure 4\.<\/span> ([^<]*)</.exec(String(peersFigure({ view, nat: same, master: master('990001'), n: 4, source: 's' }).fig));
  assert.doesNotMatch(takeaway, /runs from/);
  assert.match(takeaway, /0% in every group/);
});

test('the groups\' takeaway says where the score sits in words for all, some, one and none of the groups, never "0 of"', () => {
  const groups = (...medians) => medians.map((median) => ({ g: { median } }));
  assert.equal(peersPosition(1, groups(0, 0.5, 0.9)), 'Its score is above the middle in all 3 groups it belongs to');
  assert.equal(peersPosition(1, groups(0, 2, 3)), 'Its score is above the middle in 1 of the 3 groups it belongs to');
  assert.equal(peersPosition(1, groups(0, 0.5, 3)), 'Its score is above the middle in 2 of the 3 groups it belongs to');
  assert.equal(peersPosition(-1, groups(0, 0.5, 3)), 'Its score is below the middle in all 3 groups it belongs to');
  assert.equal(peersPosition(0, groups(0, 0.5, 3)), 'Its score is at or below the middle in all 3 groups it belongs to', 'on a group\'s middle is not below it');
  assert.equal(peersPosition(1, groups(0, 0.5)), 'Its score is above the middle in both groups it belongs to');
  assert.equal(peersPosition(-1, groups(0, 0.5)), 'Its score is below the middle in both groups it belongs to');
  assert.equal(peersPosition(0.2, groups(0, 0.5)), 'Its score is above the middle in 1 of the 2 groups it belongs to');
  // One group: named as one, never "all 1 groups".
  assert.equal(peersPosition(1, groups(0)), 'Its score is above the middle of the one group it belongs to');
  assert.equal(peersPosition(-1, groups(0)), 'Its score is below the middle of the one group it belongs to');
  assert.equal(peersPosition(0, groups(0)), 'Its score is at or below the middle of the one group it belongs to');
  assert.throws(() => peersPosition(1, []), RangeError, 'no groups: nothing to say');
  // Every pinned hospital with the figure: the takeaway never counts zero groups.
  for (const h of DATA.hospitals.filter((x) => x.total !== null).slice(0, 400)) {
    const fig = peersFigure({ view: pinnedView(h), nat: NAT, master: DATA.master.get(h.ccn), n: 4, source: 's' });
    if (fig) assert.doesNotMatch(String(fig.fig), /middle (?:of|in) 0 of|\b(\d+) of the \1 groups/, 'a pinned hospital\'s takeaway');
  }
});

test('the nearest hospitals\' takeaway reads "none of" and "all" rather than "0 of" or "8 of the 8"', () => {
  const h = DATA.hospitals.find((x) => x.total !== null && Number.isFinite(DATA.master.get(x.ccn).lat));
  const view = pinnedView(h);
  const near = NAT.nearest(h.ccn, view.point);
  const takeaway = (decision) => String(nearbyBlock({ view, nat: { ...NAT, nearest: () => near.map((x) => ({ ...x, decision })) }, shapes: DATA.shapes, n: 5, source: 's' }).fig);
  assert.match(takeaway('No'), new RegExp(`CMS cut none of the ${near.length} nearest hospitals;`));
  assert.match(takeaway('Yes'), new RegExp(`CMS cut all ${near.length} nearest hospitals;`));
});

test('the ledger\'s first line reads "all" when CMS scored every measure', () => {
  const all = DATA.hospitals.find((x) => x.total !== null && pinnedView(x).n === MEASURE_IDS.length);
  const some = DATA.hospitals.find((x) => x.total !== null && pinnedView(x).n < MEASURE_IDS.length);
  const page = (h) => hospitalPage({ ...PAGE_CTX, view: pinnedView(h), hospital: h, master: DATA.master.get(h.ccn), source: DATA.source, robots: null, assets: ASSETS, whatif: { hospital: h, model, estimate, range: RANGE } });
  assert.match(page(all), new RegExp(`CMS scored this hospital on all ${MEASURE_IDS.length} measures\\.`));
  assert.match(page(some), new RegExp(`CMS scored this hospital on ${pinnedView(some).n} of the ${MEASURE_IDS.length} measures\\.`));
});

test('review: a hospital less than a mile away reads "less than a mile", never 0 miles', () => {
  const h = DATA.hospitals.find((x) => x.total !== null && Number.isFinite(DATA.master.get(x.ccn).lat));
  const view = pinnedView(h);
  const near = NAT.nearest(h.ccn, view.point);
  const fake = { ...NAT, nearest: () => near.map((x, i) => ({ ...x, miles: i === 0 ? 0.2 : x.miles })) };
  const block = nearbyBlock({ view, nat: fake, shapes: DATA.shapes, n: 5, source: 's' });
  assert.match(String(block.fig), /the closest is less than a mile away\./);
  assert.doesNotMatch(String(block.table), /<td class="num">0<\/td>/);
});

test('a distance in words: under a mile, about a mile for one, whole miles with their noun otherwise (a tooltip never reads "1 miles")', () => {
  assert.equal(milesText(0.4), 'less than a mile');
  assert.equal(milesText(1.3), 'about a mile');
  assert.equal(milesText(1.49), 'about a mile');
  assert.equal(milesText(3.2), '3 miles');
  assert.equal(milesText(1.5), '2 miles');
  for (const x of [0, 0.4, 0.99, 1, 1.3, 1.49, 1.5, 3.2, 40]) assert.doesNotMatch(milesText(x), /\b1 miles\b|under 1/, String(x));
});

test('the nearest hospitals\' takeaway and tooltips say the distance in words: under a mile, about a mile, whole miles', () => {
  const h = DATA.hospitals.find((x) => x.total !== null && Number.isFinite(DATA.master.get(x.ccn).lat));
  const view = pinnedView(h);
  const near = NAT.nearest(h.ccn, view.point);
  for (const [miles, takeaway, tip] of [[0.4, 'less than a mile away', 'less than a mile'], [1.2, 'about a mile away', 'about a mile'], [3.2, '3 miles away', '3 miles']]) {
    const fake = { ...NAT, nearest: () => near.map((x, i) => ({ ...x, miles: i === 0 ? miles : x.miles })) };
    const fig = String(nearbyBlock({ view, nat: fake, shapes: DATA.shapes, n: 5, source: 's' }).fig);
    assert.match(fig, new RegExp(`the closest is ${takeaway}\\.`));
    assert.ok(fig.includes(`, ${tip}</title>`), `the first marker's tooltip says ${tip}`);
    assert.doesNotMatch(fig, /\b1 miles\b|under 1 miles/);
  }
});

test('the rank under the line bar never rounds across 75: a hospital CMS didn\'t cut, just under it, reads lower', () => {
  // A not-cut hospital whose score is above 74.5% but below 75% of the other scores (rounding would say 75%).
  const others = NAT.scores.length - 1;
  const h = pick((x) => x.paymentReduction === 'No' && x.total !== null && NAT.rankOf(x.total).below / others >= 0.745 && NAT.rankOf(x.total).below / others < 0.75, 'not cut, between 74.5% and 75%');
  const bar = String(lineBarBlock(pinnedView(h), NAT));
  assert.match(bar, /Higher than 74% of the other/);
  assert.doesNotMatch(bar, /Higher than 75%/);
});
