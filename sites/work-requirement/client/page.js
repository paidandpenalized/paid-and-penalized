// The work-requirement program page's script. Step 1's strips are drawn whole at build time (web/program/strips.js); once
// the strips' rows arrive (the asset the stage names, data-strips) this redraws them in place with the same arithmetic:
// the page's hospital threaded through its three dots, the Find's matches lit, and a group from the chips kept over the
// gray outline of every hospital. Without the script, or without the rows, the page stays as the server drew it, and
// the chips and the Find stay hidden.
import { setFollowed } from '../../../web/client/follow.js';
import { DEFAULT_SCENARIO, SCENARIOS } from '../web/constants.js';
import { decodeStrips, drawn, stripsBody, stripsLayout } from '../web/program/strips.js';
import { mountChips } from './chips.js';
import { defaultPool, mountFind, pageHospital } from './find.js';

const DRAWINGS = ['narrow', 'wide'];

async function start(stage) {
  let data;
  try {
    const res = await fetch(stage.dataset.strips);
    if (!res.ok) return;
    data = decodeStrips(await res.json());
  } catch {
    return;
  }
  const items = drawn(data.rows);
  const at = new Map(items.map((r, i) => [r.ccn, i]));
  const byCcn = new Map(data.rows.map((r) => [r.ccn, r]));
  const svgs = DRAWINGS.map((drawing) => [drawing, stage.querySelector(`svg[data-fit="${drawing}"]`)]).filter(([, svg]) => svg);

  // What the strips show. hospital: the page's (a row; its thread only when it is drawn); lit: the Find's matches (item
  // indexes); group: the chips' ({ name, test }) or null.
  const pool = defaultPool(data.rows);
  const view = {
    selected: DEFAULT_SCENARIO,
    hospital: pageHospital(window.location.search, byCcn) ?? pool[Math.floor(Math.random() * pool.length)],
    lit: null,
    group: null,
  };
  // The layouts change only with the case shown or the group; the hospital and the matches only redraw over them.
  let layouts = null;
  const draw = () => {
    layouts ??= svgs.map(([drawing]) => stripsLayout({ items, drawing, top: data.top, selected: view.selected, only: view.group?.test ?? null }));
    const i = at.get(view.hospital?.ccn);
    const hospital = i === undefined ? null : { i, name: view.hospital.name };
    svgs.forEach(([, svg], n) => {
      svg.innerHTML = stripsBody(layouts[n], { words: data.words, group: view.group && { name: view.group.name }, lit: view.lit, hospital }).text;
    });
  };

  const chips = stage.closest('section')?.querySelector('.wr-chips');
  if (chips) {
    const refresh = mountChips(chips, {
      items,
      onGroup: (group) => {
        view.group = group;
        layouts = null;
        draw();
      },
    });
    refresh(SCENARIOS.indexOf(view.selected));
  }
  const form = document.querySelector('header.fam form#omni');
  if (form) {
    mountFind(form, {
      rows: data.rows,
      onLit: (ccns) => {
        view.lit = ccns ? [...ccns].map((c) => at.get(c)).filter((i) => i !== undefined) : null;
        draw();
      },
      onPick: (row) => {
        view.hospital = row;
        setFollowed(row.ccn);
        draw();
      },
    });
  }
  draw();
}

const stage = typeof document === 'undefined' ? null : document.querySelector('[data-strips]');
if (stage) start(stage);
