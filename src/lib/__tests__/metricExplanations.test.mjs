import test from 'node:test';
import assert from 'node:assert/strict';
import { METRIC_EXPLANATIONS, getMetricExplanation } from '../../data/metricExplanations.js';

test('metricExplanations has complete structure for all entries', () => {
  const keys = Object.keys(METRIC_EXPLANATIONS);
  assert.ok(keys.length >= 10, 'Should have multiple metric explanation keys');

  keys.forEach((key) => {
    const item = METRIC_EXPLANATIONS[key];
    assert.ok(item.title, `${key} missing title`);
    assert.ok(item.definition, `${key} missing definition`);
    assert.ok(item.formula, `${key} missing formula`);
    assert.ok(item.source, `${key} missing source`);
    assert.ok(item.varianceReason, `${key} missing varianceReason`);
  });
});

test('getMetricExplanation returns definition and fallback gracefully', () => {
  const plts = getMetricExplanation('plts_avoided_emission');
  assert.equal(plts.title, 'Emisi Terhindar');
  assert.match(plts.formula, /0,997/);

  const fallback = getMetricExplanation('unknown_key_123');
  assert.ok(fallback.definition);
  assert.ok(fallback.formula);
  assert.ok(fallback.source);
  assert.ok(fallback.varianceReason);
});

test('verifies all expected PLTS and Scope 2 keys exist in config', () => {
  const expectedKeys = [
    'plts_capacity',
    'plts_production',
    'plts_savings',
    'plts_avoided_emission',
    'plts_monthly_comparison',
    'plts_energy_composition',
    'plts_summary_capacity',
    'plts_summary_production',
    'plts_summary_specific_yield',
    'plts_summary_co2',
    'plts_summary_status',
    'plts_summary_yoy',
    'plts_multi_dc_analytics',
    'scope2_emission_ytd',
    'scope2_purchased_mwh',
    'scope2_emission_intensity',
    'scope2_annual_projection',
    'scope2_waterfall',
    'scope2_monthly_trend',
    'scope2_ranking_table',
  ];

  expectedKeys.forEach((key) => {
    assert.ok(METRIC_EXPLANATIONS[key], `Missing configuration for ${key}`);
  });
});
