import dotenv from 'dotenv';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  acknowledgeAlert,
  getAlerts,
  getDeviceStatus,
  getRecentSensorReadings,
  getRootAnalyses,
  getSensorReadings,
  getSettings,
  insertContactInquiry,
  insertRootAnalysis,
  insertSensorReading,
  updateDeviceStatus,
  updateSettings,
} from './server/db';
import { clamp, computeRootHealthFusion, toSafeCsv } from './src/lib/analytics';
import type { DataSource, RiskLevel } from './src/types/rootwatch';

dotenv.config();

const PORT = 3000;
const MAX_IMAGE_DATA_URL_BYTES = 5 * 1024 * 1024; // 5MB safe limit

function isValidImageUrl(url: string): boolean {
  if (url.startsWith('/src/assets/images/') && !url.includes('..')) {
    return /\.(jpg|jpeg|png|webp)$/i.test(url);
  }
  if (/^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/.test(url)) {
    return url.length <= MAX_IMAGE_DATA_URL_BYTES;
  }
  return false;
}

function asFiniteNumber(value: unknown, min: number, max: number): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '6mb' }));

  // Health probe
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, mode: 'demo_prototype', timestamp: new Date().toISOString() });
  });

  // Dashboard Overview
  app.get('/api/overview', (_req, res) => {
    const recentReadings = getRecentSensorReadings(32);
    const latestReading = recentReadings[recentReadings.length - 1];
    const previousReading =
      recentReadings.length > 1 ? recentReadings[recentReadings.length - 2] : null;
    const analyses = getRootAnalyses();
    const latestAnalysis = analyses[0] ?? null;
    const alerts = getAlerts();
    const activeAlertsCount = alerts.filter((a) => !a.acknowledged).length;
    const device = getDeviceStatus();
    const settings = getSettings();
    const fusion = computeRootHealthFusion(latestReading, recentReadings, latestAnalysis);

    res.json({
      latestReading,
      previousReading,
      fusion,
      recentReadings,
      latestAnalysis,
      activeAlertsCount,
      device,
      demoMode: settings.demoMode,
      fastDemoMode: settings.fastDemoMode,
      alertThresholds: settings.alertThresholds,
    });
  });

  // Sensor history by time window
  app.get('/api/sensors', (req, res) => {
    const rawRange = String(req.query.range || '24h');
    const range: '24h' | '7d' | '30d' | 'all' =
      rawRange === '7d' || rawRange === '30d' || rawRange === 'all' ? rawRange : '24h';
    const readings = getSensorReadings(range);
    const latest = readings[readings.length - 1];
    const analyses = getRootAnalyses();
    const fusion = latest
      ? computeRootHealthFusion(latest, readings.slice(-24), analyses[0] ?? null)
      : null;

    res.json({ range, readings, fusion });
  });

  // Simulated sensor sample generator (persists clearly tagged 'demo' reading)
  app.post('/api/sensors/simulate', (req, res) => {
    const scenario = String(req.body?.scenario || 'normal');
    const recent = getRecentSensorReadings(12);
    const prev = recent[recent.length - 1];

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
      soilPh = clamp(7.85 + jitter(0.15), 7.5, 8.3);
      rootImpedance = clamp(13.2 + jitter(1.2), 10, 16);
      notes = 'Simulated high-EC / salinity spike scenario';
    } else {
      // Gently pull back toward nominal agricultural range in normal mode
      moistureShallow = clamp(moistureShallow * 0.7 + 53 * 0.3, 38, 66);
      moistureDeep = clamp(moistureDeep * 0.7 + 57 * 0.3, 42, 68);
      soilTemp = clamp(soilTemp * 0.7 + 25.2 * 0.3, 21, 29);
      soilPh = clamp(soilPh * 0.7 + 6.55 * 0.3, 6.0, 7.2);
      soilEc = clamp(soilEc * 0.7 + 1.38 * 0.3, 0.9, 1.9);
      rootImpedance = clamp(rootImpedance * 0.7 + 18.5 * 0.3, 13, 26);
    }

    const reading = insertSensorReading({
      deviceId: 'RW-TN-001',
      moistureShallow: Number(moistureShallow.toFixed(1)),
      moistureDeep: Number(moistureDeep.toFixed(1)),
      soilTemp: Number(soilTemp.toFixed(1)),
      soilPh: Number(soilPh.toFixed(2)),
      soilEc: Number(soilEc.toFixed(2)),
      rootImpedance: Number(rootImpedance.toFixed(1)),
      source: 'demo',
      notes,
    });

    res.status(201).json({ reading });
  });

  // ESP32 / External Hardware Ingestion Prototype Endpoint
  app.post('/api/sensors/ingest', (req, res) => {
    const configuredKey = process.env.DEVICE_INGEST_KEY;
    if (configuredKey) {
      const provided = String(req.headers['x-device-key'] || '');
      if (provided !== configuredKey) {
        res.status(401).json({ error: 'Invalid device ingestion key' });
        return;
      }
    }

    const body = req.body ?? {};
    const moistureShallow = asFiniteNumber(body.moistureShallow, 0, 100);
    const moistureDeep = asFiniteNumber(body.moistureDeep, 0, 100);
    const soilTemp = asFiniteNumber(body.soilTemp, -10, 70);
    const soilPh = asFiniteNumber(body.soilPh, 0, 14);
    const soilEc = asFiniteNumber(body.soilEc, 0, 20);
    const rootImpedance = asFiniteNumber(body.rootImpedance ?? 18, 0.1, 200);

    if (
      moistureShallow === null ||
      moistureDeep === null ||
      soilTemp === null ||
      soilPh === null ||
      soilEc === null ||
      rootImpedance === null
    ) {
      res.status(400).json({ error: 'Invalid or out-of-range sensor payload values' });
      return;
    }

    const deviceId = String(body.deviceId || 'RW-TN-001').slice(0, 48);
    const source: DataSource = body.source === 'user' ? 'user' : 'device_api';
    const notes = typeof body.notes === 'string' ? body.notes.slice(0, 240) : 'HTTP API payload';

    const reading = insertSensorReading({
      deviceId,
      moistureShallow: Number(moistureShallow.toFixed(1)),
      moistureDeep: Number(moistureDeep.toFixed(1)),
      soilTemp: Number(soilTemp.toFixed(1)),
      soilPh: Number(soilPh.toFixed(2)),
      soilEc: Number(soilEc.toFixed(2)),
      rootImpedance: Number(rootImpedance.toFixed(1)),
      source,
      notes,
    });

    res.status(201).json({ reading });
  });

  // Root Vision Analyses
  app.get('/api/root-analyses', (_req, res) => {
    res.json({ analyses: getRootAnalyses() });
  });

  app.post('/api/root-analyses', (req, res) => {
    const body = req.body ?? {};
    const label = String(body.label || '').trim().slice(0, 120);
    const imageUrl = String(body.imageUrl || '').trim();
    const rootAreaPct = asFiniteNumber(body.rootAreaPct, 0, 100);
    const estimatedLengthCm = asFiniteNumber(body.estimatedLengthCm, 0, 1000);
    const healthyWhitePct = asFiniteNumber(body.healthyWhitePct, 0, 100);
    const tanOchrePct = asFiniteNumber(body.tanOchrePct, 0, 100);
    const darkBrownPct = asFiniteNumber(body.darkBrownPct, 0, 100);
    const imageQualityScore = asFiniteNumber(body.imageQualityScore, 0, 100);
    const rootHealthEstimate = asFiniteNumber(body.rootHealthEstimate, 0, 100);
    const confidencePct = asFiniteNumber(body.confidencePct, 0, 100);

    if (
      !label ||
      !isValidImageUrl(imageUrl) ||
      rootAreaPct === null ||
      estimatedLengthCm === null ||
      healthyWhitePct === null ||
      tanOchrePct === null ||
      darkBrownPct === null ||
      imageQualityScore === null ||
      rootHealthEstimate === null ||
      confidencePct === null
    ) {
      res.status(400).json({ error: 'Invalid root analysis payload or unsupported image format' });
      return;
    }

    const validRisks: RiskLevel[] = ['low', 'moderate', 'elevated', 'high'];
    const stressIndicatorLevel: RiskLevel = validRisks.includes(body.stressIndicatorLevel)
      ? body.stressIndicatorLevel
      : 'moderate';
    const qualityLabel: 'good' | 'fair' | 'poor' =
      body.qualityLabel === 'good' || body.qualityLabel === 'fair' || body.qualityLabel === 'poor'
        ? body.qualityLabel
        : 'fair';
    const source: DataSource = body.source === 'user' ? 'user' : 'demo';

    const saved = insertRootAnalysis({
      deviceId: 'RW-TN-001',
      capturedAt: new Date().toISOString(),
      label,
      imageUrl,
      rootAreaPct,
      estimatedLengthCm,
      healthyWhitePct,
      tanOchrePct,
      darkBrownPct,
      imageQualityScore: Math.round(imageQualityScore),
      qualityLabel,
      stressIndicatorLevel,
      rootHealthEstimate: Math.round(rootHealthEstimate),
      confidencePct: Math.round(confidencePct),
      summaryKey: String(body.summaryKey || 'vision_summary_moderate').slice(0, 64),
      source,
    });

    res.status(201).json({ analysis: saved });
  });

  // Alerts
  app.get('/api/alerts', (_req, res) => {
    res.json({ alerts: getAlerts() });
  });

  app.patch('/api/alerts/:id/acknowledge', (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: 'Invalid alert ID' });
      return;
    }
    const updated = acknowledgeAlert(id);
    if (!updated) {
      res.status(404).json({ error: 'Alert not found' });
      return;
    }
    res.json({ alert: updated });
  });

  // Device Management
  app.get('/api/device', (_req, res) => {
    res.json({ device: getDeviceStatus() });
  });

  app.patch('/api/device', (req, res) => {
    const body = req.body ?? {};
    const samplingIntervalMin =
      body.samplingIntervalMin !== undefined
        ? asFiniteNumber(body.samplingIntervalMin, 1, 1440)
        : undefined;
    if (body.samplingIntervalMin !== undefined && samplingIntervalMin === null) {
      res.status(400).json({ error: 'Sampling interval must be between 1 and 1440 minutes' });
      return;
    }

    const validStatuses = ['simulated_online', 'simulated_degraded', 'offline'] as const;
    const connectionStatus =
      body.connectionStatus && validStatuses.includes(body.connectionStatus)
        ? body.connectionStatus
        : undefined;

    const updated = updateDeviceStatus({
      samplingIntervalMin: samplingIntervalMin ?? undefined,
      connectionStatus,
      ping: Boolean(body.ping),
      name: typeof body.name === 'string' && body.name.trim() ? body.name.trim().slice(0, 80) : undefined,
      location:
        typeof body.location === 'string' && body.location.trim()
          ? body.location.trim().slice(0, 120)
          : undefined,
    });

    res.json({ device: updated });
  });

  // Settings
  app.get('/api/settings', (_req, res) => {
    res.json({ settings: getSettings() });
  });

  app.patch('/api/settings', (req, res) => {
    const body = req.body ?? {};
    const patch: Record<string, unknown> = {};
    if (body.language === 'en' || body.language === 'ta') patch.language = body.language;
    if (body.theme === 'light' || body.theme === 'dark') patch.theme = body.theme;
    if (typeof body.demoMode === 'boolean') patch.demoMode = body.demoMode;
    if (typeof body.fastDemoMode === 'boolean') patch.fastDemoMode = body.fastDemoMode;
    if (typeof body.autoSimulate === 'boolean') patch.autoSimulate = body.autoSimulate;
    if (typeof body.notifyAlerts === 'boolean') patch.notifyAlerts = body.notifyAlerts;
    if (typeof body.notifyCalibration === 'boolean')
      patch.notifyCalibration = body.notifyCalibration;
    if (typeof body.telegramPlannedEnabled === 'boolean')
      patch.telegramPlannedEnabled = body.telegramPlannedEnabled;
    if (typeof body.samplingIntervalMin === 'number' && body.samplingIntervalMin >= 1 && body.samplingIntervalMin <= 1440) {
      patch.samplingIntervalMin = Math.round(body.samplingIntervalMin);
    }
    if (typeof body.calibrationNote === 'string') {
      patch.calibrationNote = body.calibrationNote.slice(0, 300);
    }
    if (body.alertThresholds && typeof body.alertThresholds === 'object') {
      const t = body.alertThresholds as Record<string, unknown>;
      const moistureMin = asFiniteNumber(t.moistureMin, 0, 95);
      const moistureMax = asFiniteNumber(t.moistureMax, 5, 100);
      const tempMin = asFiniteNumber(t.tempMin, 0, 50);
      const tempMax = asFiniteNumber(t.tempMax, 5, 60);

      if (
        moistureMin === null ||
        moistureMax === null ||
        tempMin === null ||
        tempMax === null ||
        moistureMin >= moistureMax ||
        tempMin >= tempMax
      ) {
        res.status(400).json({
          error:
            'Invalid alert thresholds. Ensure min is less than max and values are within valid moisture (0–100%) and temperature (0–60°C) ranges.',
        });
        return;
      }

      patch.alertThresholds = {
        moistureMin: Number(moistureMin.toFixed(1)),
        moistureMax: Number(moistureMax.toFixed(1)),
        tempMin: Number(tempMin.toFixed(1)),
        tempMax: Number(tempMax.toFixed(1)),
      };
    }

    const updated = updateSettings(patch);
    res.json({ settings: updated });
  });

  // Data Management + CSV Export
  app.get('/api/data/records', (_req, res) => {
    res.json({
      sensors: getSensorReadings('all').reverse(),
      analyses: getRootAnalyses(),
      alerts: getAlerts(),
      device: getDeviceStatus(),
    });
  });

  app.get('/api/export/csv', (req, res) => {
    const table = String(req.query.table || 'sensors');
    let csv = '';
    let filename = 'rootwatch-sensors.csv';

    if (table === 'analyses') {
      filename = 'rootwatch-root-analyses.csv';
      const rows = getRootAnalyses().map((a) => [
        a.id,
        a.deviceId,
        a.capturedAt,
        a.label,
        a.rootAreaPct,
        a.estimatedLengthCm,
        a.healthyWhitePct,
        a.tanOchrePct,
        a.darkBrownPct,
        a.imageQualityScore,
        a.stressIndicatorLevel,
        a.rootHealthEstimate,
        a.confidencePct,
        a.source,
      ]);
      csv = toSafeCsv(
        [
          'ID',
          'Device ID',
          'Captured At',
          'Label',
          'Root Area %',
          'Est Length cm',
          'Healthy White %',
          'Tan Ochre %',
          'Dark Brown %',
          'Image Quality',
          'Stress Indicator',
          'Root Health Est',
          'Confidence %',
          'Data Source',
        ],
        rows,
      );
    } else if (table === 'alerts') {
      filename = 'rootwatch-alerts.csv';
      const rows = getAlerts().map((a) => [
        a.id,
        a.deviceId,
        a.createdAt,
        a.category,
        a.severity,
        a.metricContext,
        a.acknowledged ? 'Acknowledged' : 'Active',
        a.acknowledgedAt ?? '',
        a.source,
      ]);
      csv = toSafeCsv(
        [
          'ID',
          'Device ID',
          'Created At',
          'Category',
          'Severity',
          'Details',
          'Status',
          'Acknowledged At',
          'Data Source',
        ],
        rows,
      );
    } else {
      const rows = getSensorReadings('all')
        .reverse()
        .map((r) => [
          r.id,
          r.deviceId,
          r.recordedAt,
          r.moistureShallow,
          r.moistureDeep,
          r.soilTemp,
          r.soilPh,
          r.soilEc,
          r.rootImpedance,
          r.rootHealthScore,
          r.riskLevel,
          r.source,
          r.notes ?? '',
        ]);
      csv = toSafeCsv(
        [
          'ID',
          'Device ID',
          'Recorded At',
          'Moisture 10cm (%)',
          'Moisture 25cm (%)',
          'Soil Temp (C)',
          'Soil pH',
          'Soil EC (mS/cm)',
          'Root Impedance (kOhm)',
          'Prototype Health Score',
          'Disease Risk Index',
          'Data Source',
          'Notes',
        ],
        rows,
      );
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  });

  // Landing Page Contact Form
  app.post('/api/contact', (req, res) => {
    const body = req.body ?? {};
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim();
    const farmLocation = String(body.farmLocation || '').trim();
    const message = String(body.message || '').trim();

    if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || message.length < 6) {
      res.status(400).json({ error: 'Please provide a valid name, email address, and message.' });
      return;
    }

    const saved = insertContactInquiry({
      name: name.slice(0, 100),
      email: email.slice(0, 120),
      farmLocation: farmLocation.slice(0, 120) || 'Not specified',
      message: message.slice(0, 1000),
    });

    res.status(201).json({ inquiry: saved });
  });

  // Mount Vite middleware in development or serve built dist/ in production
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found. Run npm run build first.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`RootWatch server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start RootWatch server:', err);
  process.exit(1);
});
