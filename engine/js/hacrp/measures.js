// The six HACRP measures and their column names in CMS's hospital file (PDC yq43-i98g).

function measure(id, valueColumn, zPrefix) {
  return Object.freeze({
    id,
    value: valueColumn,
    valueFootnote: `${valueColumn} Footnote`,
    z: `${zPrefix} W Z Score`,
    zFootnote: `${zPrefix} W Z Footnote`,
  });
}

export const MEASURES = Object.freeze([
  measure('PSI90', 'PSI 90 Composite Value', 'PSI 90'),
  measure('CLABSI', 'CLABSI SIR', 'CLABSI'),
  measure('CAUTI', 'CAUTI SIR', 'CAUTI'),
  measure('SSI', 'SSI SIR', 'SSI'),
  measure('CDI', 'CDI SIR', 'CDI'),
  measure('MRSA', 'MRSA SIR', 'MRSA'),
]);

export const MEASURE_IDS = Object.freeze(MEASURES.map((m) => m.id));
