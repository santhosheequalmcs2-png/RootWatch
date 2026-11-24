import { Radio, RefreshCw, Send } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useApp } from '../i18n/LanguageContext';
import { api } from '../lib/api';
import type { DeviceStatus } from '../types/rootwatch';

export function DevicesPage() {
  const { t, triggerDataRefresh, showToast } = useApp();
  const [device, setDevice] = useState<DeviceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [ingestFeedback, setIngestFeedback] = useState('');

  const loadDevice = useCallback(async () => {
    setLoading(true);
    try {
      const { device: d } = await api.getDevice();
      setDevice(d);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDevice();
  }, [loadDevice]);

  const handlePing = async () => {
    setBusy(true);
    try {
      const { device: updated } = await api.updateDevice({ ping: true });
      setDevice(updated);
      showToast(t('devices_ping_btn'), 'success');
    } finally {
      setBusy(false);
    }
  };

  const handleCycleStatus = async () => {
    if (!device) return;
    setBusy(true);
    const order: DeviceStatus['connectionStatus'][] = [
      'simulated_online',
      'simulated_degraded',
      'offline',
    ];
    const next = order[(order.indexOf(device.connectionStatus) + 1) % order.length];
    try {
      const { device: updated } = await api.updateDevice({ connectionStatus: next });
      setDevice(updated);
      triggerDataRefresh();
    } finally {
      setBusy(false);
    }
  };

  const handleIntervalChange = async (intervalMin: number) => {
    setBusy(true);
    try {
      const { device: updated } = await api.updateDevice({ samplingIntervalMin: intervalMin });
      setDevice(updated);
      showToast(t('settings_saved'), 'success');
    } finally {
      setBusy(false);
    }
  };

  const handleTestIngest = async () => {
    setBusy(true);
    setIngestFeedback('');
    try {
      await api.ingestTestPayload({
        deviceId: device?.deviceId || 'RW-TN-001',
        moistureShallow: 54.6,
        moistureDeep: 59.2,
        soilTemp: 25.8,
        soilPh: 6.65,
        soilEc: 1.44,
        rootImpedance: 18.9,
        notes: 'Test ESP32 HTTP API JSON payload',
      });
      setIngestFeedback(t('devices_test_ingest_ok'));
      triggerDataRefresh();
      await loadDevice();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Test payload failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 border-b border-[#DCE3DD] pb-5 lg:flex-row lg:items-end dark:border-[#1E3126]">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#122B1E] sm:text-3xl dark:text-[#F0F6F2]">
            {t('devices_title')}
          </h1>
          <p className="mt-1 text-sm text-[#4B6155] dark:text-[#9DB4A7]">{t('devices_subtitle')}</p>
          <p className="mt-2 text-xs text-[#8B5A2B] dark:text-[#E2B478]">
            {t('devices_sim_notice')}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void handlePing()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#153625] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#1E4B33] disabled:opacity-60 dark:bg-[#2E7D4F] whitespace-nowrap"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} />
            <span>{t('devices_ping_btn')}</span>
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleCycleStatus()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#CFD9D1] bg-white px-3.5 py-2 text-xs font-semibold text-[#153625] hover:bg-[#EDF2EE] disabled:opacity-60 dark:border-[#24382C] dark:bg-[#121F18] dark:text-[#DCEEE3] whitespace-nowrap"
          >
            <Radio className="h-3.5 w-3.5" />
            <span>{t('devices_status_toggle')}</span>
          </button>
        </div>
      </div>

      {loading || !device ? (
        <div className="rounded-xl border border-[#DCE3DD] bg-white p-8 text-sm text-[#5A7064] dark:border-[#1E3126] dark:bg-[#121F18]">
          {t('loading_text')}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Device Overview Card */}
          <section className="rounded-xl border border-[#DCE3DD] bg-white p-6 lg:col-span-7 dark:border-[#1E3126] dark:bg-[#121F18]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="font-mono text-xs text-[#5A7064] dark:text-[#8BA396]">
                  {t('devices_id_label')}: {device.deviceId}
                </div>
                <h2 className="mt-1 font-display text-xl font-bold text-[#122B1E] dark:text-white">
                  {device.name}
                </h2>
                <p className="mt-0.5 text-xs text-[#4B6155] dark:text-[#9DB4A7]">
                  {device.location} · {device.cropType}
                </p>
              </div>
              <span className="font-mono text-xs font-semibold text-[#2E7D4F] dark:text-[#7BE0A2]">
                {t(`status_${device.connectionStatus}`)}
              </span>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4 border-t border-[#ECF0EC] pt-5 sm:grid-cols-4 dark:border-[#1B2D22]">
              <div>
                <div className="text-xs text-[#5A7064] dark:text-[#8BA396]">
                  {t('devices_battery')}
                </div>
                <div className="mt-1 font-mono text-lg font-bold tabular-nums text-[#122B1E] dark:text-white">
                  {device.batteryPct}%
                </div>
                <div className="text-[11px] text-[#2E7D4F] dark:text-[#7BE0A2]">
                  {device.solarCharging ? 'Solar Float' : 'Battery'}
                </div>
              </div>
              <div>
                <div className="text-xs text-[#5A7064] dark:text-[#8BA396]">{t('devices_wifi')}</div>
                <div className="mt-1 font-mono text-lg font-bold tabular-nums text-[#122B1E] dark:text-white">
                  {device.wifiRssiDbm} dBm
                </div>
              </div>
              <div>
                <div className="text-xs text-[#5A7064] dark:text-[#8BA396]">
                  {t('devices_firmware')}
                </div>
                <div className="mt-1 font-mono text-sm font-semibold text-[#122B1E] dark:text-white">
                  {device.firmwareVersion}
                </div>
              </div>
              <div>
                <div className="text-xs text-[#5A7064] dark:text-[#8BA396]">
                  {t('devices_last_comm')}
                </div>
                <div className="mt-1 font-mono text-xs tabular-nums text-[#122B1E] dark:text-white">
                  {new Date(device.lastCommunication).toLocaleTimeString()}
                </div>
              </div>
            </div>

            {/* Sampling Interval Selector */}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#ECF0EC] pt-5 dark:border-[#1B2D22]">
              <span className="text-xs font-semibold text-[#2A4034] dark:text-[#C5DACD]">
                {t('devices_interval')}
              </span>
              <div className="inline-flex rounded-lg border border-[#CFD9D1] bg-[#EDF1EC] p-0.5 dark:border-[#24382C] dark:bg-[#0E1813]">
                {[5, 15, 30, 60].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => void handleIntervalChange(mins)}
                    className={`rounded-md px-3 py-1 font-mono text-xs font-semibold transition-colors ${
                      device.samplingIntervalMin === mins
                        ? 'bg-white text-[#122B1E] shadow-sm dark:bg-[#235439] dark:text-white'
                        : 'text-[#4B6155] dark:text-[#98B2A4]'
                    }`}
                  >
                    {mins} {t('minutes_short')}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Attached Sensor Bus Diagnostics */}
          <section className="rounded-xl border border-[#DCE3DD] bg-white p-6 lg:col-span-5 dark:border-[#1E3126] dark:bg-[#121F18]">
            <h2 className="font-display text-base font-semibold text-[#122B1E] dark:text-[#F0F6F2]">
              {t('devices_sensors_title')}
            </h2>
            <div className="mt-4 divide-y divide-[#ECF0EC] text-sm dark:divide-[#1B2D22]">
              {(
                [
                  ['sensors_shallow_label', device.sensors.moistureShallow],
                  ['sensors_deep_label', device.sensors.moistureDeep],
                  ['metric_temp', device.sensors.soilTemp],
                  ['metric_ph', device.sensors.soilPh],
                  ['metric_ec', device.sensors.soilEc],
                  ['sensors_impedance_label', device.sensors.impedance],
                  ['part_camera_name', device.sensors.camera],
                ] as const
              ).map(([labelKey, status]) => (
                <div key={labelKey} className="flex items-center justify-between py-2.5 text-xs">
                  <span className="font-medium text-[#2A4034] dark:text-[#C5DACD]">
                    {t(labelKey)}
                  </span>
                  <span
                    className={`font-mono font-semibold ${
                      status === 'ok'
                        ? 'text-[#1E6B40] dark:text-[#6EE7A0]'
                        : 'text-[#A16207] dark:text-[#FACC15]'
                    }`}
                  >
                    {status === 'ok'
                      ? t('sensors_health_ok')
                      : status === 'calibrating'
                        ? t('sensors_health_cal')
                        : t('sensors_health_exp')}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* ESP32 HTTP / MQTT Integration Blueprint & Live Test Ingest */}
          <section className="rounded-xl border border-[#DCE3DD] bg-white p-6 lg:col-span-12 dark:border-[#1E3126] dark:bg-[#121F18]">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h2 className="font-display text-base font-semibold text-[#122B1E] dark:text-[#F0F6F2]">
                  {t('devices_esp32_title')}
                </h2>
                <p className="mt-1 text-xs text-[#4B6155] dark:text-[#9DB4A7]">
                  {t('devices_esp32_desc')}
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleTestIngest()}
                className="inline-flex items-center gap-1.5 self-start rounded-lg bg-[#153625] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1E4B33] disabled:opacity-60 sm:self-auto dark:bg-[#2E7D4F] whitespace-nowrap shrink-0"
              >
                <Send className="h-3.5 w-3.5" />
                <span>{t('devices_test_ingest')}</span>
              </button>
            </div>

            {ingestFeedback && (
              <p className="mt-3 text-xs font-semibold text-[#1E6B40] dark:text-[#7BE0A2]">
                {ingestFeedback}
              </p>
            )}

            <pre className="mt-4 overflow-x-auto rounded-lg border border-[#DCE3DD] bg-[#F7F8F5] p-4 font-mono text-xs text-[#243B2F] dark:border-[#1E3126] dark:bg-[#0C1410] dark:text-[#B9CEC2]">
{`POST /api/sensors/ingest
Content-Type: application/json
X-Device-Key: <optional DEVICE_INGEST_KEY env>

{
  "deviceId": "RW-TN-001",
  "moistureShallow": 54.6,
  "moistureDeep": 59.2,
  "soilTemp": 25.8,
  "soilPh": 6.65,
  "soilEc": 1.44,
  "rootImpedance": 18.9
}`}
            </pre>
          </section>
        </div>
      )}
    </div>
  );
}
