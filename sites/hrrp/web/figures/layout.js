// Where a Readmissions figure sits at 1280, as the wide drawing's width: a figure keeps its drawing's size (styles.css .pic), so a
// drawing made at its column's width keeps its text text-sized.
//   FULL   across the page
//   SIDE   the chart's 7 of 12 columns beside its words (.pic--side)
//   STEP   a Part 1 step's figure column (7 of 12 beside the step's words)
//   HALF   half of a pair (.picpair)
//   BESIDE the 5 of 12 columns beside a SIDE figure in a 7:5 pair (.picpair--side), drawn at SIDE's scale so rows of one pitch line up
//   RAIL   a place page's narrow column beside the map (5 of 12)
//   RESULT the what-if's result column on a hospital page, drawn narrower than it so its labels come out a step larger
import { html } from '../../../../web/render/html.js';

export const FULL = 1120;
export const SIDE = 640;
export const STEP = 620;
export const HALF = 540;
export const BESIDE = Math.round((SIDE * 5) / 7);
export const RAIL = 450;
export const RESULT = 460;

// A figure kept at its drawing's size; side: its words beside the chart where there is room. Nothing when it has none.
export const pic = (fig, side = false) => (fig ? html`<div class="pic${side ? ' pic--side' : ''}">${fig}</div>` : '');
