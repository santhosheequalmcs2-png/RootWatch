export type Language = 'en' | 'ta';
export type ThemeMode = 'light' | 'dark';

export type PageId =
  | 'landing'
  | 'dashboard'
  | 'sensors'
  | 'vision'
  | 'growth'
  | 'ai'
  | 'advisory'
  | 'alerts'
  | 'device-3d'
  | 'devices'
  | 'data'
  | 'settings';

export type DataSource = 'demo' | 'user' | 'device_api';
export type RiskLevel = 'low' | 'moderate' | 'elevated' | 'high';
export type AlertSeverity = 'low' | 'moderate' | 'elevated' | 'high';
export type AlertCategory =
  | 'stress'
  | 'sensor_anomaly'
  | 'device_offline'
  | 'calibration'
  | 'root_change';

export interface SensorReading {
  id: number;
  deviceId: string;
  recordedAt: string;
  moistureShallow: number; // % at 10cm depth
  moistureDeep: number; // % at 25cm depth
  soilTemp: number; // °C
  soilPh: number; // pH 0-14
  soilEc: number; // mS/cm
  rootImpedance: number; // kOhm (experimental)
  rootHealthScore: number; // 0-100 prototype score
  riskLevel: RiskLevel;
  source: DataSource;
  notes?: string;
}

export interface RootAnalysisRecord {
  id: number;
  deviceId: string;
  capturedAt: string;
  label: string;
  imageUrl: string;
  rootAreaPct: number; // % of frame occupied by root structures
  estimatedLengthCm: number;
  healthyWhitePct: number;
  tanOchrePct: number;
  darkBrownPct: number;
  imageQualityScore: number; // 0-100
  qualityLabel: 'good' | 'fair' | 'poor';
  stressIndicatorLevel: RiskLevel;
  rootHealthEstimate: number; // 0-100
  confidencePct: number; // 0-100
  summaryKey: string;
  source: DataSource;
}

export interface AlertItem {
  id: number;
  deviceId: string;
  createdAt: string;
  category: AlertCategory;
  severity: AlertSeverity;
  titleKey: string;
  explanationKey: string;
  metricContext: string;
  acknowledged: boolean;
  acknowledgedAt: string | null;
  source: DataSource;
}

export interface AdvisoryItem {
  id: string;
  priority: 'high' | 'medium' | 'low';
  titleKey: string;
  reasonKey: string;
  actionKey: string;
  metricEvidence: string;
  generatedAt: string;
}

export interface DeviceStatus {
  deviceId: string;
  name: string;
  location: string;
  cropType: string;
  connectionStatus: 'simulated_online' | 'simulated_degraded' | 'offline';
  lastCommunication: string;
  batteryPct: number;
  solarCharging: boolean;
  wifiRssiDbm: number;
  firmwareVersion: string;
  samplingIntervalMin: number;
  sensors: {
    moistureShallow: 'ok' | 'calibrating' | 'check';
    moistureDeep: 'ok' | 'calibrating' | 'check';
    soilTemp: 'ok' | 'calibrating' | 'check';
    soilPh: 'ok' | 'calibrating' | 'check';
    soilEc: 'ok' | 'calibrating' | 'check';
    impedance: 'experimental' | 'check';
    camera: 'ok' | 'check';
  };
  source: DataSource;
}

export interface AlertThresholds {
  moistureMin: number; // %
  moistureMax: number; // %
  tempMin: number; // °C
  tempMax: number; // °C
}

export interface CustomThresholdBreach {
  id: 'moisture_low' | 'moisture_high' | 'temp_low' | 'temp_high';
  metric: 'moisture' | 'temperature';
  direction: 'below' | 'above';
  severity: 'elevated' | 'high';
  titleKey: string;
  explanationKey: string;
  currentValue: number;
  thresholdValue: number;
  unit: '%' | '°C';
  metricContext: string;
}

export interface AppSettings {
  language: Language;
  theme: ThemeMode;
  demoMode: boolean;
  fastDemoMode: boolean;
  autoSimulate: boolean;
  notifyAlerts: boolean;
  notifyCalibration: boolean;
  telegramPlannedEnabled: boolean;
  samplingIntervalMin: number;
  calibrationNote: string;
  alertThresholds: AlertThresholds;
}

export interface FusionFactor {
  id: string;
  labelKey: string;
  status: 'optimal' | 'watch' | 'stress';
  impactPoints: number;
  valueDisplay: string;
}

export interface RootHealthFusionResult {
  score: number; // 0-100 prototype score
  riskLevel: RiskLevel;
  trendDelta: number;
  dataQualityPct: number;
  confidencePct: number;
  saturationHours: number;
  dryingRatePerHour: number;
  factors: FusionFactor[];
  ruleTriggers: string[];
  disclaimerKey: string;
}

export interface OverviewResponse {
  latestReading: SensorReading;
  previousReading: SensorReading | null;
  fusion: RootHealthFusionResult;
  recentReadings: SensorReading[];
  latestAnalysis: RootAnalysisRecord | null;
  activeAlertsCount: number;
  device: DeviceStatus;
  demoMode: boolean;
  fastDemoMode: boolean;
  alertThresholds: AlertThresholds;
}
