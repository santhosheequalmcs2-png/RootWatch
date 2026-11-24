import { clamp, computeRootHealthFusion, DEFAULT_ALERT_THRESHOLDS } from './analytics';
import { SAMPLE_ROOT_IMAGES } from '../data/samples';
import type {
  AlertItem,
  AppSettings,
  DeviceStatus,
  OverviewResponse,
  RiskLevel,
  RootAnalysisRecord,
  RootHealthFusionResult,
  SensorReading,
} from '../types/rootwatch';

const DEFAULT_DEVICE_ID = 'RW-TN-001';

const DEFAULT_SETTINGS: AppSettings = {
  language: 'en',
  theme: 'light',
  demoMode: true,
  fastDemoMode: false,
  autoSimulate: false,
  notifyAlerts: true,
  notifyCalibration: true,
  telegramPlannedEnabled: false,
  samplingIntervalMin: 15,
  calibrationNote: 'Last demo bench calibration: 2-point pH (4.0 / 7.0) and dry/wet capacitive sweep.',
  alertThresholds: { ...DEFAULT_ALERT_THRESHOLDS },
};

function generateInitialReadings(): SensorReading[] {
  const now = Date.now();
  const seededHistory: SensorReading[] = [];
  const timestamps: number[] = [];

  for (let h = 30 * 24; h > 24; h -= 6) {
    timestamps.push(now - h * 3_600_000);
  }
  for (let h = 24; h >= 0; h -= 1) {
    timestamps.push(now - h * 3_600_000);
  }

  timestamps.forEach((ts, idx) => {
    const hoursAgo = (now - ts) / 3_600_000;
    const dayCycle = Math.sin((idx / 4) * Math.PI * 0.5);
    const wetSpell = hoursAgo > 96 && hoursAgo < 140 ? 16 : 0;
    const recentIrrigation = hoursAgo < 10 ? 7 * Math.exp(-hoursAgo / 12) : 0;

    const moistureShallow = Number(
      (51 + 8 * Math.sin(idx * 0.35) + wetSpell + recentIrrigation).toFixed(1),
    );
    const moistureDeep = Number(
      (56 + 6 * Math.sin(idx * 0.25 - 0.5) + wetSpell * 0.85 + recentIrrigation * 0.5).toFixed(1),
    );
    const soilTemp = Number((25.2 + 2.4 * dayCycle + (hoursAgo < 36 ? 0.6 : 0)).toFixed(1));
    const soilPh = Number((6.55 + 0.16 * Math.sin(idx * 0.14)).toFixed(2));
    const soilEc = Number(
      (1.38 + 0.22 * Math.cos(idx * 0.19) + (wetSpell > 0 ? 0.35 : 0)).toFixed(2),
    );
    const rootImpedance = Number(
      (18.6 - (wetSpell > 0 ? 3.8 : 0) + 1.4 * Math.sin(idx * 0.22)).toFixed(1),
    );

    const snapshot = {
      moistureShallow,
      moistureDeep,
      soilTemp,
      soilPh,
      soilEc,
      rootImpedance,
      recordedAt: new Date(ts).toISOString(),
    };
    const fusion = computeRootHealthFusion(snapshot, seededHistory.slice(-16), null);

    seededHistory.push({
      id: idx + 1,
      deviceId: DEFAULT_DEVICE_ID,
      recordedAt: snapshot.recordedAt,
      moistureShallow,
      moistureDeep,
      soilTemp,
      soilPh,
      soilEc,
      rootImpedance,
      rootHealthScore: fusion.score,
      riskLevel: fusion.riskLevel,
      source: 'demo',
      notes: wetSpell > 0 ? 'Simulated monsoon irrigation peak' : 'Scheduled demo telemetry',
    });
  });

  return seededHistory;
}

function generateInitialAnalyses(): RootAnalysisRecord[] {
  const now = Date.now();
  const demoCaptures = [
    {
      daysAgo: 1,
      label: 'Day 29 · Saturated Zone Watch',
      imageUrl: SAMPLE_ROOT_IMAGES[2]?.imageUrl || '/assets/images/root_sample_elevated_stress_1795366666365.jpg',
      rootAreaPct: 26.2,
      estimatedLengthCm: 102.1,
      healthyWhitePct: 41.2,
      tanOchrePct: 31.4,
      darkBrownPct: 27.4,
      quality: 83,
      qLabel: 'good' as const,
      stress: 'elevated' as RiskLevel,
      health: 58,
      conf: 74,
      summaryKey: 'vision_summary_elevated',
    },
    {
      daysAgo: 5,
      label: 'Day 25 · Post-Rain Moisture Rise',
      imageUrl: SAMPLE_ROOT_IMAGES[1]?.imageUrl || '/assets/images/root_sample_mild_stress_1795366635183.jpg',
      rootAreaPct: 27.9,
      estimatedLengthCm: 108.4,
      healthyWhitePct: 64.5,
      tanOchrePct: 24.8,
      darkBrownPct: 10.7,
      quality: 86,
      qLabel: 'good' as const,
      stress: 'moderate' as RiskLevel,
      health: 74,
      conf: 76,
      summaryKey: 'vision_summary_moderate',
    },
    {
      daysAgo: 11,
      label: 'Day 19 · Active Lateral Branching',
      imageUrl: SAMPLE_ROOT_IMAGES[0]?.imageUrl || '/assets/images/root_sample_healthy_1795366637461.jpg',
      rootAreaPct: 24.8,
      estimatedLengthCm: 96.5,
      healthyWhitePct: 83.4,
      tanOchrePct: 12.2,
      darkBrownPct: 4.4,
      quality: 90,
      qLabel: 'good' as const,
      stress: 'low' as RiskLevel,
      health: 89,
      conf: 81,
      summaryKey: 'vision_summary_healthy',
    },
    {
      daysAgo: 18,
      label: 'Day 12 · Early Establishment',
      imageUrl: SAMPLE_ROOT_IMAGES[0]?.imageUrl || '/assets/images/root_sample_healthy_1795366637461.jpg',
      rootAreaPct: 16.4,
      estimatedLengthCm: 64.2,
      healthyWhitePct: 86.2,
      tanOchrePct: 10.1,
      darkBrownPct: 3.7,
      quality: 91,
      qLabel: 'good' as const,
      stress: 'low' as RiskLevel,
      health: 91,
      conf: 80,
      summaryKey: 'vision_summary_healthy',
    },
  ];

  return demoCaptures.map((c, idx) => ({
    id: idx + 1,
    deviceId: DEFAULT_DEVICE_ID,
    capturedAt: new Date(now - c.daysAgo * 86_400_000).toISOString(),
    label: c.label,
    imageUrl: c.imageUrl,
    rootAreaPct: c.rootAreaPct,
    estimatedLengthCm: c.estimatedLengthCm,
    healthyWhitePct: c.healthyWhitePct,
    tanOchrePct: c.tanOchrePct,
    darkBrownPct: c.darkBrownPct,
    imageQualityScore: c.quality,
    qualityLabel: c.qLabel,
    stressIndicatorLevel: c.stress,
    rootHealthEstimate: c.health,
    confidencePct: c.conf,
    summaryKey: c.summaryKey,
    source: 'demo',
  }));
}

function generateInitialAlerts(): AlertItem[] {
  const now = Date.now();
  return [
    {
      id: 1,
      deviceId: DEFAULT_DEVICE_ID,
      createdAt: new Date(now - 3 * 3_600_000).toISOString(),
      category: 'root_change',
      severity: 'elevated',
      titleKey: 'alert_root_color_title',
      explanationKey: 'alert_root_color_desc',
      metricContext: 'Darkened root pixels rose from 10.7% to 27.4% (demo image)',
      acknowledged: false,
      source: 'demo',
    },
    {
      id: 2,
      deviceId: DEFAULT_DEVICE_ID,
      createdAt: new Date(now - 14 * 3_600_000).toISOString(),
      category: 'stress',
      severity: 'moderate',
      titleKey: 'alert_moisture_watch_title',
      explanationKey: 'alert_moisture_watch_desc',
      metricContext: '25cm deep moisture remained above 68% after irrigation window',
      acknowledged: false,
      source: 'demo',
    },
    {
      id: 3,
      deviceId: DEFAULT_DEVICE_ID,
      createdAt: new Date(now - 38 * 3_600_000).toISOString(),
      category: 'calibration',
      severity: 'low',
      titleKey: 'alert_calibration_title',
      explanationKey: 'alert_calibration_desc',
      metricContext: 'pH probe scheduled for 30-day two-point buffer verification',
      acknowledged: false,
      source: 'demo',
    },
    {
      id: 4,
      deviceId: DEFAULT_DEVICE_ID,
      createdAt: new Date(now - 110 * 3_600_000).toISOString(),
      category: 'sensor_anomaly',
      severity: 'moderate',
      titleKey: 'alert_ec_spike_title',
      explanationKey: 'alert_ec_spike_desc',
      metricContext: 'Temporary EC drift (+0.42 mS/cm) observed during fertigation cycle',
      acknowledged: true,
      acknowledgedAt: new Date(now - 98 * 3_600_000).toISOString(),
      source: 'demo',
    },
    {
      id: 5,
      deviceId: DEFAULT_DEVICE_ID,
      createdAt: new Date(now - 190 * 3_600_000).toISOString(),
      category: 'device_offline',
      severity: 'high',
      titleKey: 'alert_offline_title',
      explanationKey: 'alert_offline_desc',
      metricContext: 'Simulated Wi-Fi reconnect after 22-minute field gateway outage',
      acknowledged: true,
      acknowledgedAt: new Date(now - 188 * 3_600_000).toISOString(),
      source: 'demo',
    },
  ];
}

function generateInitialDevice(): DeviceStatus {
  return {
    deviceId: DEFAULT_DEVICE_ID,
    name: 'RootWatch Field Node Alpha',
    location: 'Coimbatore Demonstration Plot B2 · Tamil Nadu',
    cropType: 'Turmeric & Tomato Rhizotron Trial',
    connectionStatus: 'simulated_online',
    lastCommunication: new Date(Date.now() - 4 * 60_000).toISOString(),
    batteryPct: 84,
    solarCharging: true,
    wifiRssiDbm: -61,
    firmwareVersion: 'fw-proto-0.4.2-sim',
    samplingIntervalMin: 15,
    sensors: {
      moistureShallow: 'ok',
      moistureDeep: 'ok',
      soilTemp: 'ok',
      soilPh: 'calibrating',
      soilEc: 'ok',
      impedance: 'experimental',
      camera: 'ok',
    },
    source: 'demo',
  };
}

class MockDataStore {
  private readings: SensorReading[];
  private analyses: RootAnalysisRecord[];
  private alerts: AlertItem[];
  private device: DeviceStatus;
  private settings: AppSettings;

  constructor() {
    this.readings = this.loadLocal('rw_readings', generateInitialReadings);
    this.analyses = this.loadLocal('rw_analyses', generateInitialAnalyses);
    this.alerts = this.loadLocal('rw_alerts', generateInitialAlerts);
    this.device = this.loadLocal('rw_device', generateInitialDevice);
    this.settings = this.loadLocal('rw_settings', () => DEFAULT_SETTINGS);
  }

  private loadLocal<T>(key: string, fallback: () => T): T {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const item = window.localStorage.getItem(key);
        if (item) return JSON.parse(item) as T;
      }
    } catch {
      // ignore storage error
    }
    const val = fallback();
    this.saveLocal(key, val);
    return val;
  }

  private saveLocal<T>(key: string, val: T): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, JSON.stringify(val));
      }
    } catch {
      // ignore
    }
  }

  getOverview(): OverviewResponse {
    const recentReadings = this.readings.slice(-32);
    const latestReading = recentReadings[recentReadings.length - 1];
    const previousReading =
      recentReadings.length > 1 ? recentReadings[recentReadings.length - 2] : null;
    const latestAnalysis = this.analyses[0] ?? null;
    const activeAlertsCount = this.alerts.filter((a) => !a.acknowledged).length;
    const fusion = computeRootHealthFusion(latestReading, recentReadings, latestAnalysis);

    return {
      latestReading,
      previousReading,
      fusion,
      recentReadings,
      latestAnalysis,
      activeAlertsCount,
      device: this.device,
      demoMode: this.settings.demoMode,
      fastDemoMode: this.settings.fastDemoMode,
      alertThresholds: this.settings.alertThresholds,
    };
  }

  getSensors(range: '24h' | '7d' | '30d' | 'all' = '24h'): {
    range: string;
    readings: SensorReading[];
    fusion: RootHealthFusionResult | null;
  } {
    let count = 24;
    if (range === '7d') count = 28;
    if (range === '30d' || range === 'all') count = this.readings.length;

    const readings = this.readings.slice(-count);
    const latest = readings[readings.length - 1];
    const fusion = latest
      ? computeRootHealthFusion(latest, readings.slice(-24), this.analyses[0] ?? null)
      : null;

    return { range, readings, fusion };
  }

  simulateSensor(scenario: 'normal' | 'overwatered' | 'dry_stress' | 'salinity_spike' = 'normal'): {
    reading: SensorReading;
  } {
    const prev = this.readings[this.readings.length - 1];
    const jitter = (amp: number) => (Math.random() - 0.5) * 2 * amp;

    let moistureShallow = prev ? prev.moistureShallow + jitter(3.2) : 54;
    let moistureDeep = prev ? prev.moistureDeep + jitter(2.1) : 58;
    let soilTemp = prev ? prev.soilTemp + jitter(0.8) : 25.4;
    let soilPh = prev ? prev.soilPh + jitter(0.08) : 6.6;
    let soilEc = prev ? prev.soilEc + jitter(0.12) : 1.42;
    let rootImpedance = prev ? prev.rootImpedance + jitter(1.1) : 18.2;
    let notes = 'Simulated normal demo step';

    if (scenario === 'overwatered') {
      moistureShallow = clamp(81 + jitter(3), 76, 92);
      moistureDeep = clamp(85 + jitter(2.5), 80, 94);
      soilTemp = clamp(29.8 + jitter(1.2), 27, 33);
      soilEc = clamp(1.95 + jitter(0.2), 1.5, 2.4);
      rootImpedance = clamp(10.8 + jitter(1.2), 8.5, 13.5);
      notes = 'Simulated over-irrigation / waterlogging scenario';
    } else if (scenario === 'dry_stress') {
      moistureShallow = clamp(21 + jitter(2.5), 14, 27);
      moistureDeep = clamp(28 + jitter(2.5), 22, 34);
      soilTemp = clamp(32.6 + jitter(1.1), 30, 36);
      soilEc = clamp(1.75 + jitter(0.2), 1.3, 2.2);
      rootImpedance = clamp(31.5 + jitter(2), 27, 38);
      notes = 'Simulated dry root-zone heat scenario';
    } else if (scenario === 'salinity_spike') {
      moistureShallow = clamp(48 + jitter(3), 40, 58);
      moistureDeep = clamp(53 + jitter(3), 45, 62);
      soilEc = clamp(2.88 + jitter(0.25), 2.5, 3.6);
      soilPh = clamp(7.85 + jitter(0.15), 7.4, 8.4);
      rootImpedance = clamp(14.2 + jitter(1.5), 11, 18);
      notes = 'Simulated salinity / high electrical conductivity event';
    }

    moistureShallow = Number(clamp(moistureShallow, 5, 95).toFixed(1));
    moistureDeep = Number(clamp(moistureDeep, 5, 95).toFixed(1));
    soilTemp = Number(clamp(soilTemp, 5, 50).toFixed(1));
    soilPh = Number(clamp(soilPh, 3.5, 9.5).toFixed(2));
    soilEc = Number(clamp(soilEc, 0.1, 6.0).toFixed(2));
    rootImpedance = Number(clamp(rootImpedance, 2.0, 60.0).toFixed(1));

    const snapshot = {
      moistureShallow,
      moistureDeep,
      soilTemp,
      soilPh,
      soilEc,
      rootImpedance,
      recordedAt: new Date().toISOString(),
    };

    const fusion = computeRootHealthFusion(snapshot, this.readings.slice(-16), this.analyses[0] ?? null);

    const reading: SensorReading = {
      id: this.readings.length + 1,
      deviceId: DEFAULT_DEVICE_ID,
      recordedAt: snapshot.recordedAt,
      moistureShallow,
      moistureDeep,
      soilTemp,
      soilPh,
      soilEc,
      rootImpedance,
      rootHealthScore: fusion.score,
      riskLevel: fusion.riskLevel,
      source: 'demo',
      notes,
    };

    this.readings.push(reading);
    this.saveLocal('rw_readings', this.readings);
    return { reading };
  }

  ingestTestPayload(payload: {
    deviceId: string;
    moistureShallow: number;
    moistureDeep: number;
    soilTemp: number;
    soilPh: number;
    soilEc: number;
    rootImpedance: number;
    notes?: string;
  }): { reading: SensorReading } {
    const snapshot = {
      moistureShallow: payload.moistureShallow,
      moistureDeep: payload.moistureDeep,
      soilTemp: payload.soilTemp,
      soilPh: payload.soilPh,
      soilEc: payload.soilEc,
      rootImpedance: payload.rootImpedance,
      recordedAt: new Date().toISOString(),
    };
    const fusion = computeRootHealthFusion(snapshot, this.readings.slice(-16), this.analyses[0] ?? null);

    const reading: SensorReading = {
      id: this.readings.length + 1,
      deviceId: payload.deviceId || DEFAULT_DEVICE_ID,
      recordedAt: snapshot.recordedAt,
      moistureShallow: payload.moistureShallow,
      moistureDeep: payload.moistureDeep,
      soilTemp: payload.soilTemp,
      soilPh: payload.soilPh,
      soilEc: payload.soilEc,
      rootImpedance: payload.rootImpedance,
      rootHealthScore: fusion.score,
      riskLevel: fusion.riskLevel,
      source: 'test_ingest',
      notes: payload.notes || 'Injected test telemetry',
    };

    this.readings.push(reading);
    this.saveLocal('rw_readings', this.readings);
    return { reading };
  }

  getRootAnalyses(): { analyses: RootAnalysisRecord[] } {
    return { analyses: this.analyses };
  }

  saveRootAnalysis(payload: Omit<RootAnalysisRecord, 'id' | 'deviceId' | 'capturedAt'>): {
    analysis: RootAnalysisRecord;
  } {
    const analysis: RootAnalysisRecord = {
      ...payload,
      id: this.analyses.length + 1,
      deviceId: DEFAULT_DEVICE_ID,
      capturedAt: new Date().toISOString(),
    };
    this.analyses.unshift(analysis);
    this.saveLocal('rw_analyses', this.analyses);
    return { analysis };
  }

  getAlerts(): { alerts: AlertItem[] } {
    return { alerts: this.alerts };
  }

  acknowledgeAlert(id: number): { alert: AlertItem } {
    const alert = this.alerts.find((a) => a.id === id);
    if (alert) {
      alert.acknowledged = true;
      alert.acknowledgedAt = new Date().toISOString();
      this.saveLocal('rw_alerts', this.alerts);
    }
    return { alert: alert || this.alerts[0] };
  }

  getDevice(): { device: DeviceStatus } {
    return { device: this.device };
  }

  updateDevice(patch: Partial<DeviceStatus>): { device: DeviceStatus } {
    this.device = { ...this.device, ...patch };
    this.saveLocal('rw_device', this.device);
    return { device: this.device };
  }

  getDataRecords(): {
    sensors: SensorReading[];
    analyses: RootAnalysisRecord[];
    alerts: AlertItem[];
    device: DeviceStatus;
  } {
    return {
      sensors: [...this.readings].reverse(),
      analyses: this.analyses,
      alerts: this.alerts,
      device: this.device,
    };
  }

  getSettings(): { settings: AppSettings } {
    return { settings: this.settings };
  }

  updateSettings(patch: Partial<AppSettings>): { settings: AppSettings } {
    this.settings = { ...this.settings, ...patch };
    this.saveLocal('rw_settings', this.settings);
    return { settings: this.settings };
  }

  submitContact(_payload: {
    name: string;
    email: string;
    farmLocation: string;
    message: string;
  }): { inquiry: { id: number } } {
    return { inquiry: { id: Date.now() } };
  }
}

export const mockStore = new MockDataStore();
