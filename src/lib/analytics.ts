import type {
  AdvisoryItem,
  AlertThresholds,
  CustomThresholdBreach,
  FusionFactor,
  RiskLevel,
  RootAnalysisRecord,
  RootHealthFusionResult,
  SensorReading,
} from '../types/rootwatch';

export const DEFAULT_ALERT_THRESHOLDS: AlertThresholds = {
  moistureMin: 34,
  moistureMax: 68,
  tempMin: 18,
  tempMax: 29.5,
};

export interface SensorSnapshotInput {
  moistureShallow: number;
  moistureDeep: number;
  soilTemp: number;
  soilPh: number;
  soilEc: number;
  rootImpedance: number;
  recordedAt?: string;
}

/**
 * Clamp a numeric value cleanly into [min, max].
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Evaluates a sensor reading against user-defined min/max moisture and temperature alert thresholds.
 */
export function evaluateCustomThresholdAlerts(
  reading: Pick<SensorSnapshotInput, 'moistureShallow' | 'moistureDeep' | 'soilTemp'>,
  thresholds: AlertThresholds = DEFAULT_ALERT_THRESHOLDS,
): CustomThresholdBreach[] {
  const breaches: CustomThresholdBreach[] = [];
  const avgMoisture = Number(((reading.moistureShallow + reading.moistureDeep) / 2).toFixed(1));
  const soilTemp = Number(reading.soilTemp.toFixed(1));

  if (avgMoisture < thresholds.moistureMin) {
    const gap = thresholds.moistureMin - avgMoisture;
    breaches.push({
      id: 'moisture_low',
      metric: 'moisture',
      direction: 'below',
      severity: gap >= 8 ? 'high' : 'elevated',
      titleKey: 'alert_custom_moisture_low_title',
      explanationKey: 'alert_custom_moisture_low_desc',
      currentValue: avgMoisture,
      thresholdValue: thresholds.moistureMin,
      unit: '%',
      metricContext: `Avg moisture ${avgMoisture}% < custom min ${thresholds.moistureMin}% (10cm: ${reading.moistureShallow.toFixed(1)}%, 25cm: ${reading.moistureDeep.toFixed(1)}%)`,
    });
  } else if (avgMoisture > thresholds.moistureMax) {
    const gap = avgMoisture - thresholds.moistureMax;
    breaches.push({
      id: 'moisture_high',
      metric: 'moisture',
      direction: 'above',
      severity: gap >= 8 ? 'high' : 'elevated',
      titleKey: 'alert_custom_moisture_high_title',
      explanationKey: 'alert_custom_moisture_high_desc',
      currentValue: avgMoisture,
      thresholdValue: thresholds.moistureMax,
      unit: '%',
      metricContext: `Avg moisture ${avgMoisture}% > custom max ${thresholds.moistureMax}% (10cm: ${reading.moistureShallow.toFixed(1)}%, 25cm: ${reading.moistureDeep.toFixed(1)}%)`,
    });
  }

  if (soilTemp < thresholds.tempMin) {
    const gap = thresholds.tempMin - soilTemp;
    breaches.push({
      id: 'temp_low',
      metric: 'temperature',
      direction: 'below',
      severity: gap >= 3 ? 'high' : 'elevated',
      titleKey: 'alert_custom_temp_low_title',
      explanationKey: 'alert_custom_temp_low_desc',
      currentValue: soilTemp,
      thresholdValue: thresholds.tempMin,
      unit: '°C',
      metricContext: `Soil temperature ${soilTemp}°C < custom min ${thresholds.tempMin}°C`,
    });
  } else if (soilTemp > thresholds.tempMax) {
    const gap = soilTemp - thresholds.tempMax;
    breaches.push({
      id: 'temp_high',
      metric: 'temperature',
      direction: 'above',
      severity: gap >= 3 ? 'high' : 'elevated',
      titleKey: 'alert_custom_temp_high_title',
      explanationKey: 'alert_custom_temp_high_desc',
      currentValue: soilTemp,
      thresholdValue: thresholds.tempMax,
      unit: '°C',
      metricContext: `Soil temperature ${soilTemp}°C > custom max ${thresholds.tempMax}°C`,
    });
  }

  return breaches;
}

/**
 * Layer 2 Feature Extractor: computes prolonged saturation hours and hourly drying rate
 * from chronological sensor readings (oldest -> newest).
 */
export function computeSensorTrendFeatures(readings: SensorReading[]): {
  saturationHours: number;
  dryingRatePerHour: number;
  ecDrift: number;
  tempDelta: number;
} {
  if (readings.length === 0) {
    return { saturationHours: 0, dryingRatePerHour: 0, ecDrift: 0, tempDelta: 0 };
  }

  let saturationHours = 0;
  for (let i = readings.length - 1; i >= 0; i--) {
    const r = readings[i];
    const avgMoisture = (r.moistureShallow + r.moistureDeep) / 2;
    if (avgMoisture >= 72) {
      if (i > 0) {
        const dtMs =
          new Date(r.recordedAt).getTime() - new Date(readings[i - 1].recordedAt).getTime();
        const dtHours = clamp(dtMs / 3_600_000, 0.25, 12);
        saturationHours += dtHours;
      } else {
        saturationHours += 1;
      }
    } else {
      break;
    }
  }

  if (readings.length < 2) {
    return {
      saturationHours: Number(saturationHours.toFixed(1)),
      dryingRatePerHour: 0,
      ecDrift: 0,
      tempDelta: 0,
    };
  }

  const latest = readings[readings.length - 1];
  const windowStart = readings[Math.max(0, readings.length - 6)];
  const elapsedHours = Math.max(
    0.5,
    (new Date(latest.recordedAt).getTime() - new Date(windowStart.recordedAt).getTime()) /
      3_600_000,
  );

  const moistureChange = windowStart.moistureShallow - latest.moistureShallow;
  const dryingRatePerHour = Number((moistureChange / elapsedHours).toFixed(2));
  const ecDrift = Number((latest.soilEc - windowStart.soilEc).toFixed(2));
  const tempDelta = Number((latest.soilTemp - windowStart.soilTemp).toFixed(1));

  return {
    saturationHours: Number(saturationHours.toFixed(1)),
    dryingRatePerHour,
    ecDrift,
    tempDelta,
  };
}

/**
 * Layer 1 + Layer 2 + Layer 4 Prototype Data Fusion Engine.
 * Combines rule-based sensor thresholds, moisture duration trends, and optional root image signals
 * into a transparent 0-100 prototype Root Health Score and cautious Disease-Risk Index.
 */
export function computeRootHealthFusion(
  current: SensorSnapshotInput,
  history: SensorReading[] = [],
  latestImage: Pick<
    RootAnalysisRecord,
    'healthyWhitePct' | 'darkBrownPct' | 'imageQualityScore' | 'rootAreaPct'
  > | null = null,
): RootHealthFusionResult {
  const trends = computeSensorTrendFeatures(history);
  const factors: FusionFactor[] = [];
  const ruleTriggers: string[] = [];

  let penalty = 0;

  // 1. Moisture balance & prolonged saturation
  const avgMoisture = (current.moistureShallow + current.moistureDeep) / 2;
  let moisturePenalty = 0;
  let moistureStatus: 'optimal' | 'watch' | 'stress' = 'optimal';

  if (avgMoisture > 78) {
    moisturePenalty = Math.min(30, Math.round((avgMoisture - 74) * 1.4));
    moistureStatus = 'stress';
    ruleTriggers.push('rule_prolonged_saturation');
  } else if (avgMoisture > 68) {
    moisturePenalty = Math.round((avgMoisture - 66) * 0.9);
    moistureStatus = 'watch';
    ruleTriggers.push('rule_elevated_moisture');
  } else if (avgMoisture < 26) {
    moisturePenalty = Math.min(28, Math.round((30 - avgMoisture) * 1.3));
    moistureStatus = 'stress';
    ruleTriggers.push('rule_dry_root_zone');
  } else if (avgMoisture < 34) {
    moisturePenalty = Math.round((36 - avgMoisture) * 0.8);
    moistureStatus = 'watch';
  }

  if (trends.saturationHours >= 12) {
    moisturePenalty += Math.min(12, Math.round(trends.saturationHours / 3));
    moistureStatus = 'stress';
    if (!ruleTriggers.includes('rule_prolonged_saturation')) {
      ruleTriggers.push('rule_prolonged_saturation');
    }
  }
  penalty += moisturePenalty;
  factors.push({
    id: 'moisture',
    labelKey: 'factor_moisture',
    status: moistureStatus,
    impactPoints: -moisturePenalty,
    valueDisplay: `${current.moistureShallow.toFixed(0)}% / ${current.moistureDeep.toFixed(0)}%`,
  });

  // 2. Soil Temperature (optimal 20-29°C for tropical/Tamil Nadu vegetable crops)
  let tempPenalty = 0;
  let tempStatus: 'optimal' | 'watch' | 'stress' = 'optimal';
  if (current.soilTemp > 33 || current.soilTemp < 14) {
    tempPenalty = 16;
    tempStatus = 'stress';
    ruleTriggers.push('rule_thermal_stress');
  } else if (current.soilTemp > 29.5 || current.soilTemp < 18) {
    tempPenalty = 7;
    tempStatus = 'watch';
  }
  penalty += tempPenalty;
  factors.push({
    id: 'temperature',
    labelKey: 'factor_temperature',
    status: tempStatus,
    impactPoints: -tempPenalty,
    valueDisplay: `${current.soilTemp.toFixed(1)} °C`,
  });

  // 3. Soil pH (optimal 6.0 - 7.2)
  let phPenalty = 0;
  let phStatus: 'optimal' | 'watch' | 'stress' = 'optimal';
  if (current.soilPh < 5.4 || current.soilPh > 7.9) {
    phPenalty = 15;
    phStatus = 'stress';
    ruleTriggers.push('rule_ph_imbalance');
  } else if (current.soilPh < 5.9 || current.soilPh > 7.3) {
    phPenalty = 6;
    phStatus = 'watch';
  }
  penalty += phPenalty;
  factors.push({
    id: 'ph',
    labelKey: 'factor_ph',
    status: phStatus,
    impactPoints: -phPenalty,
    valueDisplay: `${current.soilPh.toFixed(2)} pH`,
  });

  // 4. Electrical Conductivity (EC optimal 0.8 - 2.0 mS/cm)
  let ecPenalty = 0;
  let ecStatus: 'optimal' | 'watch' | 'stress' = 'optimal';
  if (current.soilEc > 2.6 || current.soilEc < 0.4) {
    ecPenalty = 16;
    ecStatus = 'stress';
    ruleTriggers.push('rule_ec_salinity');
  } else if (current.soilEc > 2.1 || current.soilEc < 0.7) {
    ecPenalty = 7;
    ecStatus = 'watch';
  }
  penalty += ecPenalty;
  factors.push({
    id: 'ec',
    labelKey: 'factor_ec',
    status: ecStatus,
    impactPoints: -ecPenalty,
    valueDisplay: `${current.soilEc.toFixed(2)} mS/cm`,
  });

  // 5. Experimental Root Impedance (prototype baseline 12-28 kOhm)
  let impPenalty = 0;
  let impStatus: 'optimal' | 'watch' | 'stress' = 'optimal';
  if (current.rootImpedance < 8 || current.rootImpedance > 36) {
    impPenalty = 8;
    impStatus = 'watch';
    ruleTriggers.push('rule_impedance_shift');
  }
  penalty += impPenalty;
  factors.push({
    id: 'impedance',
    labelKey: 'factor_impedance',
    status: impStatus,
    impactPoints: -impPenalty,
    valueDisplay: `${current.rootImpedance.toFixed(1)} kΩ`,
  });

  // 6. Optional Layer 3 Root Vision signal
  if (latestImage) {
    let visionPenalty = 0;
    let visionStatus: 'optimal' | 'watch' | 'stress' = 'optimal';
    if (latestImage.darkBrownPct >= 26) {
      visionPenalty = 16;
      visionStatus = 'stress';
      ruleTriggers.push('rule_root_discoloration');
    } else if (latestImage.darkBrownPct >= 14) {
      visionPenalty = 8;
      visionStatus = 'watch';
    }
    penalty += visionPenalty;
    factors.push({
      id: 'vision',
      labelKey: 'factor_vision',
      status: visionStatus,
      impactPoints: -visionPenalty,
      valueDisplay: `${Math.round(latestImage.healthyWhitePct)}% / ${Math.round(latestImage.darkBrownPct)}%`,
    });
  }

  const score = clamp(Math.round(96 - penalty), 15, 98);

  let riskLevel: RiskLevel = 'low';
  if (score < 48 || (avgMoisture > 78 && current.soilTemp > 29 && trends.saturationHours >= 12)) {
    riskLevel = 'high';
  } else if (score < 64) {
    riskLevel = 'elevated';
  } else if (score < 78) {
    riskLevel = 'moderate';
  }

  const sensorOnlyPenalty = latestImage
    ? penalty - (factors.find((f) => f.id === 'vision')?.impactPoints ? Math.abs(factors.find((f) => f.id === 'vision')!.impactPoints) : 0)
    : penalty;
  const sensorOnlyScore = clamp(Math.round(96 - sensorOnlyPenalty), 15, 98);
  const previousScore =
    history.length >= 2 ? history[history.length - 2].rootHealthScore : sensorOnlyScore;
  const trendDelta = Number((sensorOnlyScore - previousScore).toFixed(1));

  // Data quality & confidence estimate (honest prototype heuristic)
  const sensorConsistencyOk =
    Math.abs(current.moistureShallow - current.moistureDeep) <= 32 &&
    current.soilPh >= 3.5 &&
    current.soilPh <= 9.5;
  const dataQualityPct = sensorConsistencyOk ? (latestImage ? 88 : 81) : 64;
  const confidencePct = latestImage
    ? clamp(Math.round((dataQualityPct + latestImage.imageQualityScore) / 2 - 8), 45, 84)
    : clamp(dataQualityPct - 12, 42, 74);

  return {
    score,
    riskLevel,
    trendDelta,
    dataQualityPct,
    confidencePct,
    saturationHours: trends.saturationHours,
    dryingRatePerHour: trends.dryingRatePerHour,
    factors,
    ruleTriggers,
    disclaimerKey: 'prototype_scoring_disclaimer',
  };
}

/**
 * Generates cautious, explainable Smart Agricultural Advisories.
 * Never prescribes pesticides or claims confirmed pathogen diagnosis.
 */
export function generateAdvisories(
  latest: SensorReading,
  fusion: RootHealthFusionResult,
  latestAnalysis: RootAnalysisRecord | null,
): AdvisoryItem[] {
  const items: AdvisoryItem[] = [];
  const now = latest.recordedAt;
  const avgMoisture = (latest.moistureShallow + latest.moistureDeep) / 2;

  if (avgMoisture >= 70 || fusion.saturationHours >= 8) {
    items.push({
      id: 'adv-irrigation-saturation',
      priority: avgMoisture >= 78 ? 'high' : 'medium',
      titleKey: 'adv_saturation_title',
      reasonKey: 'adv_saturation_reason',
      actionKey: 'adv_saturation_action',
      metricEvidence: `${latest.moistureShallow.toFixed(0)}% (10cm) · ${latest.moistureDeep.toFixed(0)}% (25cm) · ${fusion.saturationHours}h`,
      generatedAt: now,
    });
    items.push({
      id: 'adv-drainage-check',
      priority: 'medium',
      titleKey: 'adv_drainage_title',
      reasonKey: 'adv_drainage_reason',
      actionKey: 'adv_drainage_action',
      metricEvidence: `${avgMoisture.toFixed(1)}% avg moisture`,
      generatedAt: now,
    });
  } else if (avgMoisture < 32) {
    items.push({
      id: 'adv-dry-soil',
      priority: 'high',
      titleKey: 'adv_dry_title',
      reasonKey: 'adv_dry_reason',
      actionKey: 'adv_dry_action',
      metricEvidence: `${latest.moistureShallow.toFixed(0)}% (10cm) · ${latest.moistureDeep.toFixed(0)}% (25cm)`,
      generatedAt: now,
    });
  }

  if (latest.soilTemp >= 30) {
    items.push({
      id: 'adv-soil-temp',
      priority: latest.soilTemp >= 33 ? 'high' : 'medium',
      titleKey: 'adv_temp_title',
      reasonKey: 'adv_temp_reason',
      actionKey: 'adv_temp_action',
      metricEvidence: `${latest.soilTemp.toFixed(1)} °C`,
      generatedAt: now,
    });
  }

  if (latest.soilEc >= 2.2 || latest.soilPh < 5.7 || latest.soilPh > 7.6) {
    items.push({
      id: 'adv-ec-ph',
      priority: latest.soilEc >= 2.6 ? 'high' : 'medium',
      titleKey: 'adv_ec_ph_title',
      reasonKey: 'adv_ec_ph_reason',
      actionKey: 'adv_ec_ph_action',
      metricEvidence: `EC ${latest.soilEc.toFixed(2)} mS/cm · pH ${latest.soilPh.toFixed(2)}`,
      generatedAt: now,
    });
  }

  if (Math.abs(latest.moistureShallow - latest.moistureDeep) > 26) {
    items.push({
      id: 'adv-calibration',
      priority: 'medium',
      titleKey: 'adv_calibration_title',
      reasonKey: 'adv_calibration_reason',
      actionKey: 'adv_calibration_action',
      metricEvidence: `Δ ${Math.abs(latest.moistureShallow - latest.moistureDeep).toFixed(1)}% depth spread`,
      generatedAt: now,
    });
  }

  if (latestAnalysis && latestAnalysis.darkBrownPct >= 16) {
    items.push({
      id: 'adv-image-compare',
      priority: latestAnalysis.darkBrownPct >= 26 ? 'high' : 'medium',
      titleKey: 'adv_vision_compare_title',
      reasonKey: 'adv_vision_compare_reason',
      actionKey: 'adv_vision_compare_action',
      metricEvidence: `${Math.round(latestAnalysis.darkBrownPct)}% darkened segments · ${Math.round(latestAnalysis.healthyWhitePct)}% pale roots`,
      generatedAt: latestAnalysis.capturedAt,
    });
  }

  if (fusion.riskLevel === 'elevated' || fusion.riskLevel === 'high') {
    items.push({
      id: 'adv-agronomist',
      priority: 'high',
      titleKey: 'adv_expert_title',
      reasonKey: 'adv_expert_reason',
      actionKey: 'adv_expert_action',
      metricEvidence: `Prototype Score ${fusion.score}/100 · Risk ${fusion.riskLevel}`,
      generatedAt: now,
    });
  }

  // Always include baseline routine observation guidance when conditions are nominal
  if (items.length === 0) {
    items.push({
      id: 'adv-routine-monitor',
      priority: 'low',
      titleKey: 'adv_nominal_title',
      reasonKey: 'adv_nominal_reason',
      actionKey: 'adv_nominal_action',
      metricEvidence: `Score ${fusion.score}/100 · Moisture ${avgMoisture.toFixed(0)}% · Temp ${latest.soilTemp.toFixed(1)} °C`,
      generatedAt: now,
    });
    items.push({
      id: 'adv-periodic-image',
      priority: 'low',
      titleKey: 'adv_vision_routine_title',
      reasonKey: 'adv_vision_routine_reason',
      actionKey: 'adv_vision_routine_action',
      metricEvidence: `48–72h image interval`,
      generatedAt: now,
    });
  }

  return items;
}

/**
 * Neutralizes spreadsheet formula injection (+, -, =, @, tab, CR) and quotes CSV cells safely.
 */
export function escapeCsvCell(value: unknown): string {
  const raw = value === null || value === undefined ? '' : String(value);
  const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  if (/[",\n\r]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

export function toSafeCsv(headers: string[], rows: Array<Array<unknown>>): string {
  const lines = [headers.map(escapeCsvCell).join(',')];
  for (const row of rows) {
    lines.push(row.map(escapeCsvCell).join(','));
  }
  return lines.join('\n');
}
