// The what-if section both HACRP pages carry: the component from its starting values, and the page data its client
// module (client/whatif.js) mounts it from. The page data hold the record and the model only as far as the browser
// reads them (whatif-state.js, whatif-text.js and the engine's whatIf), so the browser recomputes exactly what the
// build drew, never the whole file.
import { MEASURE_IDS } from '../../../../engine/js/hacrp/measures.js';
import { html, jsonScript } from '../../../../web/render/html.js';
import { renderWhatIf } from '../../../../web/whatif/render.js';
import { initialState, solverOf, viewModel } from '../whatif-state.js';
import { whatIfTexts } from '../whatif-text.js';

function browserHospital(h) {
  const measures = Object.fromEntries(MEASURE_IDS.map((id) => {
    const { value, z, zText } = h.measures[id];
    return [id, { value, z, zText }];
  }));
  return { ccn: h.ccn, measures, total: h.total, totalText: h.totalText, paymentReduction: h.paymentReduction, periods: { hai: h.periods.hai } };
}

// Every fitted parameter but the bookkeeping (the id and the count of hospitals it was fit on).
function browserModel(model) {
  const params = Object.fromEntries(Object.entries(model.params).map(([id, { id: _id, n: _n, ...p }]) => [id, p]));
  return { params, boundary: model.boundary };
}

const browserEstimate = (estimate) => Object.fromEntries(Object.entries(estimate).map(([id, { tagged }]) => [id, { tagged }]));

// The page data: { hospital, model, estimate, page, range }. whatif: { hospital, model, estimate, range } (range:
// the ramp's national span of scores). page: { name, fy, path, source, boundaryText, baseline, share }, the fields
// whatIfTexts takes plus share; source is cut to what the slide text cites.
export function whatIfData({ hospital, model, estimate, range }, page) {
  const source = { id: page.source.id, pdcReleased: page.source.pdcReleased };
  return {
    hospital: browserHospital(hospital),
    model: browserModel(model),
    estimate: browserEstimate(estimate),
    page: { ...page, source },
    range,
  };
}

// The section's HTML and its page data, under the script id dataId.
export function whatIfSection(whatif, page, dataId) {
  const { hospital, model, estimate, range } = whatif;
  const data = whatIfData(whatif, page);
  const vm = viewModel(initialState(hospital, model), hospital, model, estimate);
  const texts = whatIfTexts({ hospital, model, ...data.page });
  return html`${renderWhatIf({ vm, texts, share: page.share, range, solver: solverOf(hospital, model) })}
${jsonScript(dataId, data)}`;
}
