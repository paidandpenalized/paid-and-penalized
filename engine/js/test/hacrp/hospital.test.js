import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MEASURES, MEASURE_IDS } from '../../hacrp/measures.js';
import { toHospital, scoredMeasures, isAssigned } from '../../hacrp/hospital.js';
import { syntheticRow } from './synthetic.js';

test('six measures in CMS column order', () => {
  assert.deepEqual(MEASURE_IDS, ['PSI90', 'CLABSI', 'CAUTI', 'SSI', 'CDI', 'MRSA']);
  assert.equal(MEASURES[0].value, 'PSI 90 Composite Value');
  assert.equal(MEASURES[1].z, 'CLABSI W Z Score');
});

test('CCN stays a string with its leading zero; numbers parse; CMS text is kept', () => {
  const h = toHospital(syntheticRow({ 'CLABSI SIR': '0.512' }));
  assert.equal(h.ccn, '010001');
  assert.equal(h.measures.CLABSI.value, 0.512);
  assert.equal(h.measures.CLABSI.valueText, '0.512');
  assert.equal(h.total, 0.1);
  assert.equal(h.totalText, '0.1000');
  assert.deepEqual(h.periods, { psi90: { start: '07/01/2022', end: '06/30/2024' }, hai: { start: '01/01/2023', end: '12/31/2024' } });
});

test('N/A becomes null and footnotes are kept verbatim', () => {
  const h = toHospital(syntheticRow({ 'CAUTI SIR': 'N/A', 'CAUTI SIR Footnote': '18', 'Total HAC Score': 'N/A', 'Total HAC Score Footnote': '5' }));
  assert.equal(h.measures.CAUTI.value, null);
  assert.equal(h.measures.CAUTI.valueFootnote, '18');
  assert.equal(h.total, null);
  assert.equal(h.totalFootnote, '5');
});

test('assigned = published z with no published value; scoredMeasures lists measures with a z', () => {
  const h = toHospital(syntheticRow({ 'SSI SIR': 'N/A', 'MRSA SIR': 'N/A', 'MRSA W Z Score': 'N/A' }));
  assert.equal(isAssigned(h.measures.SSI), true);
  assert.equal(isAssigned(h.measures.CDI), false);
  assert.deepEqual(scoredMeasures(h), ['PSI90', 'CLABSI', 'CAUTI', 'SSI', 'CDI']);
});

test('unexpected Payment Reduction or a non-numeric value throws (schema drift)', () => {
  assert.throws(() => toHospital(syntheticRow({ 'Payment Reduction': 'Maybe' })), /Payment Reduction/);
  assert.throws(() => toHospital(syntheticRow({ 'CDI SIR': 'abc' })), /CDI SIR/);
  const missing = syntheticRow();
  delete missing['MRSA W Z Score'];
  assert.throws(() => toHospital(missing), /MRSA W Z Score/);
});
