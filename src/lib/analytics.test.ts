import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeRootHealthFusion,
  computeSensorTrendFeatures,
  DEFAULT_ALERT_THRESHOLDS,
  escapeCsvCell,
  evaluateCustomThresholdAlerts,
  generateAdvisories,
  toSafeCsv,
} from './analytics';
import type { SensorReading } from '../types/rootwatch';

function makeReading(overrides: Partial<SensorReading> = {}, idx = 0): SensorReading {
  const baseTime = new Date('2026-11-20T06:00:00Z').getTime() + idx * 3_600_000;
  return {
    id: idx + 1,
    deviceId: 'RW-TN-001',
    recordedAt: new Date(baseTime).toISOString(),
    moistureShallow: 52,
    moistureDeep: 56,
    soilTemp: 24.5,
    soilPh: 6.6,
    soilEc: 1.35,
    rootImpedance: 18.4,
    rootHealthScore: 88,
    riskLevel: 'low',
    source: 'demo',
    ...overrides,
  };
}

test('computeRootHealthFusion scores optimal conditions high with low risk', () => {
  const history = [makeReading({}, 0), makeReading({}, 1), makeReading({}, 2)];
  const result = computeRootHealthFusion(history[2], history, {
    healthyWhitePct: 84,
    darkBrownPct: 5,
    imageQualityScore: 90,
    rootAreaPct: 24,
  });

  assert.ok(result.score >= 85, `Expected score >= 85, got ${result.score}`);
  assert.equal(result.riskLevel, 'low');
  assert.equal(result.factors.length, 6);
  assert.equal(result.ruleTriggers.length, 0);
});

test('computeRootHealthFusion escalates risk under prolonged saturation and high EC', () => {
  const saturatedHistory: SensorReading[] = [];
  for (let i = 0; i < 16; i++) {
    saturatedHistory.push(
      makeReading(
        {
          moistureShallow: 83,
          moistureDeep: 86,
          soilTemp: 31.5,
          soilEc: 2.9,
          soilPh: 5.2,
          rootHealthScore: 52,
        },
        i,
      ),
    );
  }
  const latest = saturatedHistory[saturatedHistory.length - 1];
  const result = computeRootHealthFusion(latest, saturatedHistory, {
    healthyWhitePct: 36,
    darkBrownPct: 34,
    imageQualityScore: 80,
    rootAreaPct: 16,
  });

  assert.equal(result.riskLevel, 'high');
  assert.ok(result.score < 50, `Expected score < 50, got ${result.score}`);
  assert.ok(result.saturationHours >= 12);
  assert.ok(result.ruleTriggers.includes('rule_prolonged_saturation'));
  assert.ok(result.ruleTriggers.includes('rule_ec_salinity'));
  assert.ok(result.ruleTriggers.includes('rule_root_discoloration'));
});

test('computeSensorTrendFeatures calculates positive drying rate when moisture drops', () => {
  const readings = [
    makeReading({ moistureShallow: 62 }, 0),
    makeReading({ moistureShallow: 59 }, 1),
    makeReading({ moistureShallow: 56 }, 2),
    makeReading({ moistureShallow: 53 }, 3),
  ];
  const trends = computeSensorTrendFeatures(readings);
  assert.equal(trends.dryingRatePerHour, 3);
  assert.equal(trends.saturationHours, 0);
});

test('generateAdvisories emits drainage and expert recommendations under stress without omitting evidence', () => {
  const stressed = makeReading({
    moistureShallow: 82,
    moistureDeep: 85,
    soilTemp: 33.4,
    soilEc: 2.8,
  });
  const history = Array.from({ length: 14 }, (_, i) =>
    makeReading({ moistureShallow: 80, moistureDeep: 84, soilTemp: 32 }, i),
  );
  const fusion = computeRootHealthFusion(stressed, history, null);
  const advisories = generateAdvisories(stressed, fusion, null);

  assert.ok(advisories.some((a) => a.id === 'adv-irrigation-saturation'));
  assert.ok(advisories.some((a) => a.id === 'adv-drainage-check'));
  assert.ok(advisories.some((a) => a.id === 'adv-agronomist'));
  assert.ok(advisories.every((a) => a.metricEvidence.length > 0));
});

test('toSafeCsv neutralizes spreadsheet formula injection characters', () => {
  assert.equal(escapeCsvCell('=SUM(A1:A5)'), "'=SUM(A1:A5)");
  assert.equal(escapeCsvCell('+cmd'), "'+cmd");
  assert.equal(escapeCsvCell('normal,text'), '"normal,text"');
  const csv = toSafeCsv(['Name', 'Value'], [['=1+1', '42']]);
  assert.equal(csv, "Name,Value\n'=1+1,42");
});

test('evaluateCustomThresholdAlerts triggers alerts only when readings fall outside min/max bounds', () => {
  const nominal = makeReading({ moistureShallow: 50, moistureDeep: 54, soilTemp: 24.5 });
  assert.equal(evaluateCustomThresholdAlerts(nominal, DEFAULT_ALERT_THRESHOLDS).length, 0);

  const tightBounds = { moistureMin: 55, moistureMax: 65, tempMin: 20, tempMax: 24 };
  const breaches = evaluateCustomThresholdAlerts(nominal, tightBounds);
  assert.equal(breaches.length, 2);
  assert.equal(breaches[0].id, 'moisture_low');
  assert.equal(breaches[0].severity, 'elevated');
  assert.equal(breaches[1].id, 'temp_high');
  assert.equal(breaches[1].severity, 'elevated');

  const severe = makeReading({ moistureShallow: 80, moistureDeep: 84, soilTemp: 14 });
  const severeBreaches = evaluateCustomThresholdAlerts(severe, DEFAULT_ALERT_THRESHOLDS);
  assert.equal(severeBreaches.length, 2);
  assert.equal(severeBreaches[0].id, 'moisture_high');
  assert.equal(severeBreaches[0].severity, 'high');
  assert.equal(severeBreaches[1].id, 'temp_low');
  assert.equal(severeBreaches[1].severity, 'high');
});
