import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import {
  computeRootHealthFusion,
  DEFAULT_ALERT_THRESHOLDS,
  evaluateCustomThresholdAlerts,
} from '../src/lib/analytics';
import type {
  AlertCategory,
  AlertItem,
  AlertSeverity,
  AppSettings,
  DataSource,
  DeviceStatus,
  RiskLevel,
  RootAnalysisRecord,
  SensorReading,
} from '../src/types/rootwatch';

const defaultDbPath = path.resolve(process.cwd(), 'data', 'rootwatch.db');
const dbPath = process.env.SQLITE_DB_PATH
  ? path.resolve(process.env.SQLITE_DB_PATH)
  : defaultDbPath;

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize relational SQLite schema
db.exec(`
  CREATE TABLE IF NOT EXISTS sensor_readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT NOT NULL,
    recorded_at TEXT NOT NULL,
    moisture_shallow REAL NOT NULL,
    moisture_deep REAL NOT NULL,
    soil_temp REAL NOT NULL,
    soil_ph REAL NOT NULL,
    soil_ec REAL NOT NULL,
    root_impedance REAL NOT NULL,
    root_health_score INTEGER NOT NULL,
    risk_level TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'demo',
    notes TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_sensor_recorded_at ON sensor_readings(recorded_at);

  CREATE TABLE IF NOT EXISTS root_analyses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT NOT NULL,
    captured_at TEXT NOT NULL,
    label TEXT NOT NULL,
    image_url TEXT NOT NULL,
    root_area_pct REAL NOT NULL,
    estimated_length_cm REAL NOT NULL,
    healthy_white_pct REAL NOT NULL,
    tan_ochre_pct REAL NOT NULL,
    dark_brown_pct REAL NOT NULL,
    image_quality_score INTEGER NOT NULL,
    quality_label TEXT NOT NULL,
    stress_indicator_level TEXT NOT NULL,
    root_health_estimate INTEGER NOT NULL,
    confidence_pct INTEGER NOT NULL,
    summary_key TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'demo'
  );

  CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    category TEXT NOT NULL,
    severity TEXT NOT NULL,
    title_key TEXT NOT NULL,
    explanation_key TEXT NOT NULL,
    metric_context TEXT NOT NULL,
    acknowledged INTEGER NOT NULL DEFAULT 0,
    acknowledged_at TEXT,
    source TEXT NOT NULL DEFAULT 'demo'
  );

  CREATE TABLE IF NOT EXISTS devices (
    device_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    crop_type TEXT NOT NULL,
    connection_status TEXT NOT NULL,
    last_communication TEXT NOT NULL,
    battery_pct INTEGER NOT NULL,
    solar_charging INTEGER NOT NULL,
    wifi_rssi_dbm INTEGER NOT NULL,
    firmware_version TEXT NOT NULL,
    sampling_interval_min INTEGER NOT NULL,
    sensors_json TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'demo'
  );

  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value_json TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS contact_inquiries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    farm_location TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

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

function seedDatabaseIfEmpty() {
  const countRow = db.prepare('SELECT COUNT(*) as cnt FROM sensor_readings').get() as {
    cnt: number;
  };
  if (countRow.cnt > 0) {
    return;
  }

  const now = Date.now();
  const insertReading = db.prepare(`
    INSERT INTO sensor_readings (
      device_id, recorded_at, moisture_shallow, moisture_deep, soil_temp,
      soil_ph, soil_ec, root_impedance, root_health_score, risk_level, source, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Seed 30 days of realistic deterministic demo readings (every 6h for days 30..2, hourly for last 24h)
  const seededHistory: SensorReading[] = [];
  const timestamps: number[] = [];

  for (let h = 30 * 24; h > 24; h -= 6) {
    timestamps.push(now - h * 3_600_000);
  }
  for (let h = 24; h >= 0; h -= 1) {
    timestamps.push(now - h * 3_600_000);
  }

  const tx = db.transaction(() => {
    timestamps.forEach((ts, idx) => {
      const hoursAgo = (now - ts) / 3_600_000;
      const dayCycle = Math.sin((idx / 4) * Math.PI * 0.5);
      // Create a gentle realistic irrigation + drying cycle over 30 days, with a brief wet spell ~5 days ago
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

      const res = insertReading.run(
        DEFAULT_DEVICE_ID,
        snapshot.recordedAt,
        moistureShallow,
        moistureDeep,
        soilTemp,
        soilPh,
        soilEc,
        rootImpedance,
        fusion.score,
        fusion.riskLevel,
        'demo',
        wetSpell > 0 ? 'Simulated monsoon irrigation peak' : 'Scheduled demo telemetry',
      );

      seededHistory.push({
        id: Number(res.lastInsertRowid),
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
      });
    });

    // Seed Root Vision / Growth History demo captures using generated sample root images
    const insertAnalysis = db.prepare(`
      INSERT INTO root_analyses (
        device_id, captured_at, label, image_url, root_area_pct, estimated_length_cm,
        healthy_white_pct, tan_ochre_pct, dark_brown_pct, image_quality_score,
        quality_label, stress_indicator_level, root_health_estimate, confidence_pct,
        summary_key, source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const demoCaptures = [
      {
        daysAgo: 18,
        label: 'Day 12 · Early Establishment',
        imageUrl: '/src/assets/images/root_sample_healthy_1795366637461.jpg',
        rootAreaPct: 16.4,
        estimatedLengthCm: 64.2,
        healthyWhitePct: 86.2,
        tanOchrePct: 10.1,
        darkBrownPct: 3.7,
        quality: 91,
        qLabel: 'good',
        stress: 'low',
        health: 91,
        conf: 80,
        summaryKey: 'vision_summary_healthy',
      },
      {
        daysAgo: 11,
        label: 'Day 19 · Active Lateral Branching',
        imageUrl: '/src/assets/images/root_sample_healthy_1795366637461.jpg',
        rootAreaPct: 24.8,
        estimatedLengthCm: 96.5,
        healthyWhitePct: 83.4,
        tanOchrePct: 12.2,
        darkBrownPct: 4.4,
        quality: 90,
        qLabel: 'good',
        stress: 'low',
        health: 89,
        conf: 81,
        summaryKey: 'vision_summary_healthy',
      },
      {
        daysAgo: 5,
        label: 'Day 25 · Post-Rain Moisture Rise',
        imageUrl: '/src/assets/images/root_sample_mild_stress_1795366635183.jpg',
        rootAreaPct: 27.9,
        estimatedLengthCm: 108.4,
        healthyWhitePct: 64.5,
        tanOchrePct: 24.8,
        darkBrownPct: 10.7,
        quality: 86,
        qLabel: 'good',
        stress: 'moderate',
        health: 74,
        conf: 76,
        summaryKey: 'vision_summary_moderate',
      },
      {
        daysAgo: 1,
        label: 'Day 29 · Saturated Zone Watch',
        imageUrl: '/src/assets/images/root_sample_elevated_stress_1795366666365.jpg',
        rootAreaPct: 26.2,
        estimatedLengthCm: 102.1,
        healthyWhitePct: 41.2,
        tanOchrePct: 31.4,
        darkBrownPct: 27.4,
        quality: 83,
        qLabel: 'good',
        stress: 'elevated',
        health: 58,
        conf: 74,
        summaryKey: 'vision_summary_elevated',
      },
    ];

    for (const c of demoCaptures) {
      insertAnalysis.run(
        DEFAULT_DEVICE_ID,
        new Date(now - c.daysAgo * 86_400_000).toISOString(),
        c.label,
        c.imageUrl,
        c.rootAreaPct,
        c.estimatedLengthCm,
        c.healthyWhitePct,
        c.tanOchrePct,
        c.darkBrownPct,
        c.quality,
        c.qLabel,
        c.stress,
        c.health,
        c.conf,
        c.summaryKey,
        'demo',
      );
    }

    // Seed Alerts
    const insertAlert = db.prepare(`
      INSERT INTO alerts (
        device_id, created_at, category, severity, title_key, explanation_key,
        metric_context, acknowledged, acknowledged_at, source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertAlert.run(
      DEFAULT_DEVICE_ID,
      new Date(now - 3 * 3_600_000).toISOString(),
      'root_change',
      'elevated',
      'alert_root_color_title',
      'alert_root_color_desc',
      'Darkened root pixels rose from 10.7% to 27.4% (demo image)',
      0,
      null,
      'demo',
    );
    insertAlert.run(
      DEFAULT_DEVICE_ID,
      new Date(now - 14 * 3_600_000).toISOString(),
      'stress',
      'moderate',
      'alert_moisture_watch_title',
      'alert_moisture_watch_desc',
      '25cm deep moisture remained above 68% after irrigation window',
      0,
      null,
      'demo',
    );
    insertAlert.run(
      DEFAULT_DEVICE_ID,
      new Date(now - 38 * 3_600_000).toISOString(),
      'calibration',
      'low',
      'alert_calibration_title',
      'alert_calibration_desc',
      'pH probe scheduled for 30-day two-point buffer verification',
      0,
      null,
      'demo',
    );
    insertAlert.run(
      DEFAULT_DEVICE_ID,
      new Date(now - 110 * 3_600_000).toISOString(),
      'sensor_anomaly',
      'moderate',
      'alert_ec_spike_title',
      'alert_ec_spike_desc',
      'Temporary EC drift (+0.42 mS/cm) observed during fertigation cycle',
      1,
      new Date(now - 98 * 3_600_000).toISOString(),
      'demo',
    );
    insertAlert.run(
      DEFAULT_DEVICE_ID,
      new Date(now - 190 * 3_600_000).toISOString(),
      'device_offline',
      'high',
      'alert_offline_title',
      'alert_offline_desc',
      'Simulated Wi-Fi reconnect after 22-minute field gateway outage',
      1,
      new Date(now - 188 * 3_600_000).toISOString(),
      'demo',
    );

    // Seed Device
    db.prepare(`
      INSERT INTO devices (
        device_id, name, location, crop_type, connection_status, last_communication,
        battery_pct, solar_charging, wifi_rssi_dbm, firmware_version,
        sampling_interval_min, sensors_json, source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      DEFAULT_DEVICE_ID,
      'RootWatch Field Node Alpha',
      'Coimbatore Demonstration Plot B2 · Tamil Nadu',
      'Turmeric & Tomato Rhizotron Trial',
      'simulated_online',
      new Date(now - 4 * 60_000).toISOString(),
      84,
      1,
      -61,
      'fw-proto-0.4.2-sim',
      15,
      JSON.stringify({
        moistureShallow: 'ok',
        moistureDeep: 'ok',
        soilTemp: 'ok',
        soilPh: 'calibrating',
        soilEc: 'ok',
        impedance: 'experimental',
        camera: 'ok',
      }),
      'demo',
    );

    // Seed Settings
    db.prepare('INSERT OR REPLACE INTO app_settings (key, value_json) VALUES (?, ?)').run(
      'global',
      JSON.stringify(DEFAULT_SETTINGS),
    );
  });

  tx();
}

seedDatabaseIfEmpty();

function mapSensorRow(row: Record<string, unknown>): SensorReading {
  return {
    id: Number(row.id),
    deviceId: String(row.device_id),
    recordedAt: String(row.recorded_at),
    moistureShallow: Number(row.moisture_shallow),
    moistureDeep: Number(row.moisture_deep),
    soilTemp: Number(row.soil_temp),
    soilPh: Number(row.soil_ph),
    soilEc: Number(row.soil_ec),
    rootImpedance: Number(row.root_impedance),
    rootHealthScore: Number(row.root_health_score),
    riskLevel: String(row.risk_level) as RiskLevel,
    source: String(row.source) as DataSource,
    notes: row.notes ? String(row.notes) : undefined,
  };
}

function mapAnalysisRow(row: Record<string, unknown>): RootAnalysisRecord {
  return {
    id: Number(row.id),
    deviceId: String(row.device_id),
    capturedAt: String(row.captured_at),
    label: String(row.label),
    imageUrl: String(row.image_url),
    rootAreaPct: Number(row.root_area_pct),
    estimatedLengthCm: Number(row.estimated_length_cm),
    healthyWhitePct: Number(row.healthy_white_pct),
    tanOchrePct: Number(row.tan_ochre_pct),
    darkBrownPct: Number(row.dark_brown_pct),
    imageQualityScore: Number(row.image_quality_score),
    qualityLabel: String(row.quality_label) as 'good' | 'fair' | 'poor',
    stressIndicatorLevel: String(row.stress_indicator_level) as RiskLevel,
    rootHealthEstimate: Number(row.root_health_estimate),
    confidencePct: Number(row.confidence_pct),
    summaryKey: String(row.summary_key),
    source: String(row.source) as DataSource,
  };
}

function mapAlertRow(row: Record<string, unknown>): AlertItem {
  return {
    id: Number(row.id),
    deviceId: String(row.device_id),
    createdAt: String(row.created_at),
    category: String(row.category) as AlertCategory,
    severity: String(row.severity) as AlertSeverity,
    titleKey: String(row.title_key),
    explanationKey: String(row.explanation_key),
    metricContext: String(row.metric_context),
    acknowledged: Boolean(row.acknowledged),
    acknowledgedAt: row.acknowledged_at ? String(row.acknowledged_at) : null,
    source: String(row.source) as DataSource,
  };
}

export function getSensorReadings(range: '24h' | '7d' | '30d' | 'all' = '24h'): SensorReading[] {
  if (range === 'all') {
    const rows = db
      .prepare('SELECT * FROM sensor_readings ORDER BY recorded_at ASC')
      .all() as Record<string, unknown>[];
    return rows.map(mapSensorRow);
  }
  const hours = range === '24h' ? 26 : range === '7d' ? 7 * 24 : 31 * 24;
  const cutoffIso = new Date(Date.now() - hours * 3_600_000).toISOString();
  const rows = db
    .prepare('SELECT * FROM sensor_readings WHERE recorded_at >= ? ORDER BY recorded_at ASC')
    .all(cutoffIso) as Record<string, unknown>[];
  if (rows.length > 0) {
    return rows.map(mapSensorRow);
  }
  const fallback = db
    .prepare('SELECT * FROM sensor_readings ORDER BY recorded_at DESC LIMIT 24')
    .all() as Record<string, unknown>[];
  return fallback.reverse().map(mapSensorRow);
}

export function getRecentSensorReadings(limit = 32): SensorReading[] {
  const rows = db
    .prepare('SELECT * FROM sensor_readings ORDER BY recorded_at DESC LIMIT ?')
    .all(limit) as Record<string, unknown>[];
  return rows.reverse().map(mapSensorRow);
}

export function insertSensorReading(input: {
  deviceId: string;
  moistureShallow: number;
  moistureDeep: number;
  soilTemp: number;
  soilPh: number;
  soilEc: number;
  rootImpedance: number;
  source: DataSource;
  notes?: string;
}): SensorReading {
  const history = getRecentSensorReadings(24);
  const latestAnalysis = getRootAnalyses()[0] ?? null;
  const recordedAt = new Date().toISOString();
  const fusion = computeRootHealthFusion(
    { ...input, recordedAt },
    history,
    latestAnalysis,
  );

  const res = db
    .prepare(
      `INSERT INTO sensor_readings (
        device_id, recorded_at, moisture_shallow, moisture_deep, soil_temp,
        soil_ph, soil_ec, root_impedance, root_health_score, risk_level, source, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.deviceId,
      recordedAt,
      input.moistureShallow,
      input.moistureDeep,
      input.soilTemp,
      input.soilPh,
      input.soilEc,
      input.rootImpedance,
      fusion.score,
      fusion.riskLevel,
      input.source,
      input.notes ?? null,
    );

  // Update device last communication timestamp
  db.prepare('UPDATE devices SET last_communication = ? WHERE device_id = ?').run(
    recordedAt,
    input.deviceId,
  );

  // Auto-create alerts when custom moisture/temperature thresholds are breached
  const currentSettings = getSettings();
  const customBreaches = evaluateCustomThresholdAlerts(input, currentSettings.alertThresholds);
  const recentCutoffIso = new Date(Date.now() - 10_000).toISOString();
  const checkRecentAlert = db.prepare(
    `SELECT id FROM alerts
     WHERE acknowledged = 0 AND title_key = ? AND created_at >= ?
     LIMIT 1`,
  );
  const insertAlertStmt = db.prepare(
    `INSERT INTO alerts (
      device_id, created_at, category, severity, title_key, explanation_key,
      metric_context, acknowledged, acknowledged_at, source
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, NULL, ?)`,
  );

  for (const breach of customBreaches) {
    const recentSame = checkRecentAlert.get(breach.titleKey, recentCutoffIso);
    if (!recentSame) {
      insertAlertStmt.run(
        input.deviceId,
        recordedAt,
        'stress',
        breach.severity,
        breach.titleKey,
        breach.explanationKey,
        breach.metricContext,
        input.source,
      );
    }
  }

  // Auto-create an alert when severe multi-signal stress or salinity anomaly occurs
  if (fusion.riskLevel === 'high' || fusion.riskLevel === 'elevated') {
    const avgM = (input.moistureShallow + input.moistureDeep) / 2;
    const isDry = avgM < 30;
    const isSaline = input.soilEc > 2.5;
    const titleKey = isDry
      ? 'alert_dry_stress_title'
      : isSaline
        ? 'alert_ec_spike_title'
        : 'alert_saturation_stress_title';
    const explanationKey = isDry
      ? 'alert_dry_stress_desc'
      : isSaline
        ? 'alert_ec_spike_desc'
        : 'alert_saturation_stress_desc';
    // Avoid duplicating a moisture alert if custom threshold already logged one for the same reading
    const moistureAlreadyLogged =
      !isSaline && customBreaches.some((b) => b.metric === 'moisture');
    if (!moistureAlreadyLogged && !checkRecentAlert.get(titleKey, recentCutoffIso)) {
      insertAlertStmt.run(
        input.deviceId,
        recordedAt,
        isSaline ? 'sensor_anomaly' : 'stress',
        fusion.riskLevel === 'high' ? 'high' : 'elevated',
        titleKey,
        explanationKey,
        `10cm: ${input.moistureShallow}% · 25cm: ${input.moistureDeep}% · EC: ${input.soilEc} mS/cm · Score: ${fusion.score}/100`,
        input.source,
      );
    }
  }

  const created = db
    .prepare('SELECT * FROM sensor_readings WHERE id = ?')
    .get(Number(res.lastInsertRowid)) as Record<string, unknown>;
  return mapSensorRow(created);
}

export function getRootAnalyses(): RootAnalysisRecord[] {
  const rows = db
    .prepare('SELECT * FROM root_analyses ORDER BY captured_at DESC')
    .all() as Record<string, unknown>[];
  return rows.map(mapAnalysisRow);
}

export function insertRootAnalysis(
  record: Omit<RootAnalysisRecord, 'id'>,
): RootAnalysisRecord {
  const res = db
    .prepare(
      `INSERT INTO root_analyses (
        device_id, captured_at, label, image_url, root_area_pct, estimated_length_cm,
        healthy_white_pct, tan_ochre_pct, dark_brown_pct, image_quality_score,
        quality_label, stress_indicator_level, root_health_estimate, confidence_pct,
        summary_key, source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      record.deviceId,
      record.capturedAt,
      record.label,
      record.imageUrl,
      record.rootAreaPct,
      record.estimatedLengthCm,
      record.healthyWhitePct,
      record.tanOchrePct,
      record.darkBrownPct,
      record.imageQualityScore,
      record.qualityLabel,
      record.stressIndicatorLevel,
      record.rootHealthEstimate,
      record.confidencePct,
      record.summaryKey,
      record.source,
    );

  if (record.stressIndicatorLevel === 'elevated' || record.stressIndicatorLevel === 'high') {
    db.prepare(
      `INSERT INTO alerts (
        device_id, created_at, category, severity, title_key, explanation_key,
        metric_context, acknowledged, acknowledged_at, source
      ) VALUES (?, ?, 'root_change', ?, 'alert_root_color_title', 'alert_root_color_desc', ?, 0, NULL, ?)`,
    ).run(
      record.deviceId,
      record.capturedAt,
      record.stressIndicatorLevel === 'high' ? 'high' : 'elevated',
      `${record.label}: ${record.darkBrownPct}% darkened segments (prototype vision)`,
      record.source,
    );
  }

  const created = db
    .prepare('SELECT * FROM root_analyses WHERE id = ?')
    .get(Number(res.lastInsertRowid)) as Record<string, unknown>;
  return mapAnalysisRow(created);
}

export function getAlerts(): AlertItem[] {
  const rows = db
    .prepare('SELECT * FROM alerts ORDER BY created_at DESC')
    .all() as Record<string, unknown>[];
  return rows.map(mapAlertRow);
}

export function acknowledgeAlert(id: number): AlertItem | null {
  const nowIso = new Date().toISOString();
  const info = db
    .prepare('UPDATE alerts SET acknowledged = 1, acknowledged_at = ? WHERE id = ?')
    .run(nowIso, id);
  if (info.changes === 0) return null;
  const row = db.prepare('SELECT * FROM alerts WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined;
  return row ? mapAlertRow(row) : null;
}

export function getDeviceStatus(): DeviceStatus {
  const row = db
    .prepare('SELECT * FROM devices WHERE device_id = ?')
    .get(DEFAULT_DEVICE_ID) as Record<string, unknown>;
  return {
    deviceId: String(row.device_id),
    name: String(row.name),
    location: String(row.location),
    cropType: String(row.crop_type),
    connectionStatus: String(row.connection_status) as DeviceStatus['connectionStatus'],
    lastCommunication: String(row.last_communication),
    batteryPct: Number(row.battery_pct),
    solarCharging: Boolean(row.solar_charging),
    wifiRssiDbm: Number(row.wifi_rssi_dbm),
    firmwareVersion: String(row.firmware_version),
    samplingIntervalMin: Number(row.sampling_interval_min),
    sensors: JSON.parse(String(row.sensors_json)) as DeviceStatus['sensors'],
    source: String(row.source) as DataSource,
  };
}

export function updateDeviceStatus(patch: {
  samplingIntervalMin?: number;
  connectionStatus?: DeviceStatus['connectionStatus'];
  ping?: boolean;
  name?: string;
  location?: string;
}): DeviceStatus {
  const current = getDeviceStatus();
  const nextInterval = patch.samplingIntervalMin ?? current.samplingIntervalMin;
  const nextStatus = patch.connectionStatus ?? current.connectionStatus;
  const nextName = patch.name ?? current.name;
  const nextLocation = patch.location ?? current.location;
  const nextLastComm = patch.ping ? new Date().toISOString() : current.lastCommunication;
  const nextRssi = patch.ping ? -58 - Math.floor(Math.random() * 10) : current.wifiRssiDbm;

  db.prepare(
    `UPDATE devices
     SET name = ?, location = ?, sampling_interval_min = ?, connection_status = ?, last_communication = ?, wifi_rssi_dbm = ?
     WHERE device_id = ?`,
  ).run(
    nextName,
    nextLocation,
    nextInterval,
    nextStatus,
    nextLastComm,
    nextRssi,
    DEFAULT_DEVICE_ID,
  );

  return getDeviceStatus();
}

export function getSettings(): AppSettings {
  const row = db
    .prepare('SELECT value_json FROM app_settings WHERE key = ?')
    .get('global') as { value_json: string } | undefined;
  if (!row) return { ...DEFAULT_SETTINGS, alertThresholds: { ...DEFAULT_ALERT_THRESHOLDS } };
  const parsed = JSON.parse(row.value_json) as Partial<AppSettings>;
  return {
    ...DEFAULT_SETTINGS,
    ...parsed,
    alertThresholds: {
      ...DEFAULT_ALERT_THRESHOLDS,
      ...(parsed.alertThresholds ?? {}),
    },
  };
}

export function updateSettings(patch: Partial<AppSettings>): AppSettings {
  const current = getSettings();
  const merged: AppSettings = {
    ...current,
    ...patch,
    alertThresholds: {
      ...current.alertThresholds,
      ...(patch.alertThresholds ?? {}),
    },
  };
  db.prepare('INSERT OR REPLACE INTO app_settings (key, value_json) VALUES (?, ?)').run(
    'global',
    JSON.stringify(merged),
  );
  if (typeof patch.samplingIntervalMin === 'number') {
    updateDeviceStatus({ samplingIntervalMin: patch.samplingIntervalMin });
  }
  return merged;
}

export function insertContactInquiry(input: {
  name: string;
  email: string;
  farmLocation: string;
  message: string;
}) {
  const createdAt = new Date().toISOString();
  const res = db
    .prepare(
      `INSERT INTO contact_inquiries (name, email, farm_location, message, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(input.name, input.email, input.farmLocation, input.message, createdAt);
  return { id: Number(res.lastInsertRowid), ...input, createdAt };
}
