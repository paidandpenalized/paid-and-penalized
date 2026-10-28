// A hospital page's peer table: every hospital in the group, alphabetical, with each program's estimated dollars, the
// net and the net as a share of pay; this hospital's row marked. A program a hospital is not in reads "Not in this
// program", never $0. Built when the reader first opens the fold, and again when the group changes while it is open
// (or at the next opening). Nothing here ranks: the order is the names'.
import { count, money } from '../../../web/client/format.js';
import { hospitalPathOf } from '../../../web/site.js';
import { inProgram } from '../../hospital/peers.js';
import { signedShareText } from '../../hospital/text.js';

const COLS = [
  { key: 'colHospital' }, { key: 'colCity' }, { key: 'colState' },
  { key: 'colHrrp', id: 'hrrp', num: true }, { key: 'colHac', id: 'hacrp', num: true }, { key: 'colVbp', id: 'hvbp', num: true },
  { key: 'colNet', id: 'net', num: true }, { key: 'colNetPct', num: true },
];
const DOLLARS = { hrrp: 'hrrp', hacrp: 'hac', hvbp: 'hvbp', net: 'net' };

function cell(tag, text, cls) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

// Fills details (the page's [data-peer-table]) with the table of peers, replacing any it holds. h: this hospital; fill:
// the page's copy filler; fy: the fiscal year; group: the group's name.
export function fillPeerTable(details, { peers, h, fill, fy, group }) {
  details.querySelector('.hh__tw')?.remove();
  const wrap = cell('div', undefined, 'hh__tw');
  wrap.tabIndex = 0;
  wrap.setAttribute('role', 'region');
  wrap.setAttribute('aria-label', fill('tableSummary'));
  const table = cell('table', undefined, 'hh__pt');
  table.append(cell('caption', fill('tableCaption', { fy, n: count(peers.length), group })));
  const head = document.createElement('thead');
  const hr = document.createElement('tr');
  for (const col of COLS) {
    const th = cell('th', fill(col.key), col.num ? 'num' : undefined);
    th.scope = 'col';
    hr.append(th);
  }
  head.append(hr);
  const body = document.createElement('tbody');
  const rows = [...peers].sort((a, b) => a.name.localeCompare(b.name, 'en-US') || a.ccn.localeCompare(b.ccn));
  for (const x of rows) {
    const tr = document.createElement('tr');
    const th = cell('th');
    th.scope = 'row';
    if (x === h) {
      tr.className = 'hh__me';
      th.append(cell('b', x.name), ' ', cell('span', fill('tableThis'), 'hh__metag'));
    } else {
      const a = cell('a', x.name);
      a.href = hospitalPathOf('hub', x.ccn);
      th.append(a);
    }
    tr.append(th, cell('td', x.city ?? ''), cell('td', x.state ?? ''));
    for (const col of COLS.slice(3, 7)) {
      tr.append(inProgram(x.est, col.id) ? cell('td', money(x.est[DOLLARS[col.id]], { sign: true }), 'num') : cell('td', fill('notInProgram'), 'num hh__na'));
    }
    tr.append(cell('td', signedShareText(x.est.share), 'num'));
    body.append(tr);
  }
  table.append(head, body);
  wrap.append(table);
  details.append(wrap);
}
