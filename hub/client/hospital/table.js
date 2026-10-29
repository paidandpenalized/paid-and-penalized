// A hospital page's peer table: every hospital in the group, alphabetical, with each program's estimated dollars, the
// net and the net as a share of pay; this hospital's row marked. A program a hospital is not in reads "Not in this
// program", never $0. Built when the reader first opens the fold, and again when the group changes while it is open
// (or at the next opening). Nothing here ranks: the order is the names'.
import { count } from '../../../web/client/format.js';
import { hospitalPathOf } from '../../../web/site.js';
import { ROW_KEY, inProgram } from '../../hospital/peers.js';
import { signedMoney, signedShareText } from '../../hospital/text.js';
import { node } from './dom.js';

const COLS = [
  { key: 'colHospital' }, { key: 'colCity' }, { key: 'colState' },
  { key: 'colHrrp', id: 'hrrp', num: true }, { key: 'colHac', id: 'hacrp', num: true }, { key: 'colVbp', id: 'hvbp', num: true },
  { key: 'colNet', id: 'net', num: true }, { key: 'colNetPct', num: true },
];

// A cell (or any element) holding text, with a class or none.
const cell = (tag, text, cls = null) => node(tag, { class: cls }, text ? [text] : []);

// Fills details (the page's [data-peer-table]) with the table of peers, replacing any it holds. h: this hospital; fill:
// the page's copy filler; fy: the fiscal year; group: the group's name.
export function fillPeerTable(details, { peers, h, fill, fy, group }) {
  details.querySelector('.hh__tw')?.remove();
  const wrap = node('div', { class: 'hh__tw', tabindex: 0, role: 'region', 'aria-label': fill('tableSummary') });
  const table = node('table', { class: 'hh__pt' }, [cell('caption', fill('tableCaption', { fy, n: count(peers.length), group }))]);
  const head = node('thead', {}, [node('tr', {}, COLS.map((col) => node('th', { class: col.num ? 'num' : null, scope: 'col' }, [fill(col.key)])))]);
  const body = node('tbody');
  const rows = [...peers].sort((a, b) => a.name.localeCompare(b.name, 'en-US') || a.ccn.localeCompare(b.ccn));
  for (const x of rows) {
    const me = x === h;
    const th = node('th', { scope: 'row' }, me
      ? [cell('b', x.name), ' ', cell('span', fill('tableThis'), 'hh__metag')]
      : [node('a', { href: hospitalPathOf('hub', x.ccn) }, [x.name])]);
    const tr = node('tr', { class: me ? 'hh__me' : null }, [th, cell('td', x.city ?? ''), cell('td', x.state ?? '')]);
    for (const col of COLS.slice(3, 7)) {
      tr.append(inProgram(x.est, col.id) ? cell('td', signedMoney(x.est[ROW_KEY[col.id]]), 'num') : cell('td', fill('notInProgram'), 'num hh__na'));
    }
    tr.append(cell('td', signedShareText(x.est.share), 'num'));
    body.append(tr);
  }
  table.append(head, body);
  wrap.append(table);
  details.append(wrap);
}
