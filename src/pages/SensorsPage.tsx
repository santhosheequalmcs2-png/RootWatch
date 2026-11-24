import { RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useApp } from '../i18n/LanguageContext';
import { api } from '../lib/api';
import type { SensorReading } from '../types/rootwatch';

export function SensorsPage() {
  const { t, theme, refreshTick, triggerDataRefresh, showToast } = useApp();
  const [range, setRange] = useState<'24h' | '7d' | '30d'>('24h');
  const [readings, setReadings] = useState<SensorReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);

  const loadSensors = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getSensors(range);
      setReadings(res.readings);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load sensor history', 'error');
    } finally {
      setLoading(false);
    }
  }, [range, showToast]);

  useEffect(() => {
    void loadSensors();
  }, [loadSensors, refreshTick]);

  const handleSimulateSample = async () => {
    setSimulating(true);
    try {
      await api.simulateSensor('normal');
      triggerDataRefresh();
      await loadSensors();
      showToast(t('dashboard_simulate_btn'), 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Simulation failed', 'error');
    } finally {
      setSimulating(false);
    }
  };

  const latest = readings[readings.length - 1];
  const chartRows = readings.map((r) => ({
    label:
      range === '24h'
        ? new Date(r.recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : new Date(r.recordedAt).toLocaleDateString([], { month: 'short', day: 'numeric' }),
    moistureShallow: r.moistureShallow,
    moistureDeep: r.moistureDeep,
    soilTemp: r.soilTemp,
    soilPh: r.soilPh,
    soilEc: r.soilEc,
    rootImpedance: r.rootImpedance,
  }));

  const gridStroke = theme === 'dark' ? '#1E3327' : '#E5EBE6';
  const axisColor = theme === 'dark' ? '#8CA697' : '#586E62';
  const tooltipStyle = {
    backgroundColor: theme === 'dark' ? '#101D16' : '#FFFFFF',
    borderColor: theme === 'dark' ? '#253D2F' : '#D4DDD6',
    borderRadius: '8px',
    fontSize: '12px',
    color: theme === 'dark' ? '#ECF3EE' : '#122B1E',
  };

  const sensorCards = latest
    ? [
        {
          id: 'shallow',
          name: t('sensors_shallow_label'),
          value: latest.moistureShallow.toFixed(1),
          unit: '%',
          health: t('sensors_health_ok'),
          status:
            latest.moistureShallow >= 34 && latest.moistureShallow <= 68
              ? t('status_optimal')
              : t('status_watch'),
          updated: latest.recordedAt,
        },
        {
          id: 'deep',
          name: t('sensors_deep_label'),
          value: latest.moistureDeep.toFixed(1),
          unit: '%',
          health: t('sensors_health_ok'),
          status:
            latest.moistureDeep >= 36 && latest.moistureDeep <= 70
              ? t('status_optimal')
              : t('status_watch'),
          updated: latest.recordedAt,
        },
        {
          id: 'temp',
          name: t('metric_temp'),
          value: latest.soilTemp.toFixed(1),
          unit: '°C',
          health: t('sensors_health_ok'),
          status: latest.soilTemp <= 29.5 ? t('status_optimal') : t('status_watch'),
          updated: latest.recordedAt,
        },
        {
          id: 'ph',
          name: t('metric_ph'),
          value: latest.soilPh.toFixed(2),
          unit: 'pH',
          health: t('sensors_health_cal'),
          status: latest.soilPh >= 5.9 && latest.soilPh <= 7.3 ? t('status_optimal') : t('status_watch'),
          updated: latest.recordedAt,
        },
        {
          id: 'ec',
          name: t('metric_ec'),
          value: latest.soilEc.toFixed(2),
          unit: 'mS/cm',
          health: t('sensors_health_ok'),
          status: latest.soilEc <= 2.1 ? t('status_optimal') : t('status_stress'),
          updated: latest.recordedAt,
        },
        {
          id: 'impedance',
          name: t('sensors_impedance_label'),
          value: latest.rootImpedance.toFixed(1),
          unit: 'kΩ',
          health: t('sensors_health_exp'),
          status:
            latest.rootImpedance >= 10 && latest.rootImpedance <= 30
              ? t('status_optimal')
              : t('status_watch'),
          updated: latest.recordedAt,
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 border-b border-[#DCE3DD] pb-5 lg:flex-row lg:items-end dark:border-[#1E3126]">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#122B1E] sm:text-3xl dark:text-[#F0F6F2]">
            {t('sensors_title')}
          </h1>
          <p className="mt-1 text-sm text-[#4B6155] dark:text-[#9DB4A7]">
            {t('sensors_subtitle')}
          </p>
          <p className="mt-2 text-xs text-[#8B5A2B] dark:text-[#E2B478]">
            {t('sensors_simulated_banner')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Time Range Segmented Control */}
          <div
            role="group"
            aria-label="Time Range"
            className="inline-flex rounded-lg border border-[#CFD9D1] bg-[#EDF1EC] p-1 dark:border-[#24382C] dark:bg-[#101C16]"
          >
            {(['24h', '7d', '30d'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                aria-pressed={range === r}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  range === r
                    ? 'bg-white text-[#122B1E] shadow-sm dark:bg-[#235439] dark:text-white'
                    : 'text-[#4B6155] hover:text-[#122B1E] dark:text-[#98B2A4] dark:hover:text-white'
                }`}
              >
                {t(`sensors_range_${r}`)}
              </button>
            ))}
          </div>

          <button
            type="button"
            disabled={simulating}
            onClick={() => void handleSimulateSample()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#153625] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#1E4B33] disabled:opacity-60 dark:bg-[#2E7D4F] whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${simulating ? 'animate-spin' : ''}`} />
            <span>{t('dashboard_simulate_btn')}</span>
          </button>
        </div>
      </div>

      {/* 6 Sensor Channel Readouts */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sensorCards.map((card) => (
          <div
            key={card.id}
            className="rounded-xl border border-[#DCE3DD] bg-white p-5 dark:border-[#1E3126] dark:bg-[#121F18]"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="text-sm font-semibold text-[#122B1E] dark:text-[#EDF4EF]">
                {card.name}
              </div>
              <span className="text-xs font-medium text-[#2E7D4F] dark:text-[#7BE0A2]">
                {card.status}
              </span>
            </div>

            <div className="mt-3 flex items-baseline gap-1.5">
              <span className="font-mono text-3xl font-bold tabular-nums text-[#122B1E] dark:text-white">
                {card.value}
              </span>
              <span className="font-mono text-sm text-[#5D7367] dark:text-[#8CA697]">
                {card.unit}
              </span>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-[#ECF0EC] pt-3 text-xs text-[#5A7064] dark:border-[#1B2D22] dark:text-[#8BA396]">
              <span>{card.health}</span>
              <span className="font-mono tabular-nums">
                {new Date(card.updated).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Multi-Chart Telemetry Grid */}
      {loading ? (
        <div className="h-72 rounded-xl border border-[#DCE3DD] bg-white p-6 text-sm text-[#5A7064] dark:border-[#1E3126] dark:bg-[#121F18]">
          {t('loading_text')}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Dual-Depth Moisture Chart */}
          <section className="rounded-xl border border-[#DCE3DD] bg-white p-6 dark:border-[#1E3126] dark:bg-[#121F18]">
            <h2 className="mb-4 font-display text-base font-semibold text-[#122B1E] dark:text-[#F0F6F2]">
              {t('sensors_shallow_label')} &amp; {t('sensors_deep_label')}
            </h2>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartRows} margin={{ top: 8, right: 10, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                  <XAxis dataKey="label" stroke={axisColor} tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} stroke={axisColor} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line
                    type="monotone"
                    dataKey="moistureShallow"
                    name="10 cm (%)"
                    stroke="#2E7D4F"
                    strokeWidth={2.2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="moistureDeep"
                    name="25 cm (%)"
                    stroke="#0284C7"
                    strokeWidth={2.2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Soil Temperature & Impedance Chart */}
          <section className="rounded-xl border border-[#DCE3DD] bg-white p-6 dark:border-[#1E3126] dark:bg-[#121F18]">
            <h2 className="mb-4 font-display text-base font-semibold text-[#122B1E] dark:text-[#F0F6F2]">
              {t('metric_temp')} &amp; {t('sensors_impedance_label')}
            </h2>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartRows} margin={{ top: 8, right: 10, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                  <XAxis dataKey="label" stroke={axisColor} tick={{ fontSize: 11 }} />
                  <YAxis stroke={axisColor} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line
                    type="monotone"
                    dataKey="soilTemp"
                    name={`${t('metric_temp')} (°C)`}
                    stroke="#C26A2D"
                    strokeWidth={2.2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="rootImpedance"
                    name="Impedance (kΩ)"
                    stroke="#7C3AED"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Soil EC & pH Chart */}
          <section className="rounded-xl border border-[#DCE3DD] bg-white p-6 lg:col-span-2 dark:border-[#1E3126] dark:bg-[#121F18]">
            <h2 className="mb-4 font-display text-base font-semibold text-[#122B1E] dark:text-[#F0F6F2]">
              {t('chart_ec_ph')}
            </h2>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartRows} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                  <XAxis dataKey="label" stroke={axisColor} tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" domain={[4, 9]} stroke={axisColor} tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="right" orientation="right" domain={[0, 4]} stroke={axisColor} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="soilPh"
                    name={t('metric_ph')}
                    stroke="#2E7D4F"
                    strokeWidth={2.2}
                    dot={false}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="soilEc"
                    name={`${t('metric_ec')} (mS/cm)`}
                    stroke="#B45309"
                    strokeWidth={2.2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
