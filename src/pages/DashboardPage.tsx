import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  RefreshCw,
  SlidersHorizontal,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useApp } from '../i18n/LanguageContext';
import { evaluateCustomThresholdAlerts } from '../lib/analytics';
import { api } from '../lib/api';
import type { OverviewResponse, PageId, RiskLevel } from '../types/rootwatch';

interface DashboardPageProps {
  onNavigate: (page: PageId) => void;
}

function riskColorClass(level: RiskLevel): string {
  switch (level) {
    case 'low':
      return 'text-[#1E6B40] dark:text-[#6EE7A0]';
    case 'moderate':
      return 'text-[#A16207] dark:text-[#FACC15]';
    case 'elevated':
      return 'text-[#C2410C] dark:text-[#FB923C]';
    case 'high':
      return 'text-[#B91C1C] dark:text-[#F87171]';
  }
}

function factorColorClass(status: 'optimal' | 'watch' | 'stress'): string {
  if (status === 'optimal') return 'text-[#1E6B40] dark:text-[#6EE7A0]';
  if (status === 'watch') return 'text-[#A16207] dark:text-[#FACC15]';
  return 'text-[#B91C1C] dark:text-[#F87171]';
}

export function DashboardPage({ onNavigate }: DashboardPageProps) {
  const { t, theme, settings, refreshTick, triggerDataRefresh, showToast } = useApp();
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [simulating, setSimulating] = useState(false);
  const [liveFlash, setLiveFlash] = useState(false);
  const streamInFlightRef = useRef(false);

  const loadOverview = useCallback(async () => {
    try {
      setError('');
      const res = await api.getOverview();
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview, refreshTick]);

  // Accelerated real-time simulated data stream when Demo Mode is enabled in Settings
  useEffect(() => {
    if (!settings.fastDemoMode) return;
    let cancelled = false;
    let flashTimer: number | undefined;

    const runFastTick = async () => {
      if (streamInFlightRef.current || cancelled) return;
      streamInFlightRef.current = true;
      try {
        await api.simulateSensor('normal');
        if (cancelled) return;
        const res = await api.getOverview();
        if (cancelled) return;
        setData(res);
        setLoading(false);
        setLiveFlash(true);
        window.clearTimeout(flashTimer);
        flashTimer = window.setTimeout(() => {
          if (!cancelled) setLiveFlash(false);
        }, 500);
      } catch {
        // Ignore transient background tick errors
      } finally {
        streamInFlightRef.current = false;
      }
    };

    const intervalId = window.setInterval(() => {
      void runFastTick();
    }, 3_000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.clearTimeout(flashTimer);
    };
  }, [settings.fastDemoMode]);

  const handleSimulate = async (
    scenario: 'normal' | 'overwatered' | 'dry_stress' | 'salinity_spike',
  ) => {
    setSimulating(true);
    streamInFlightRef.current = true;
    try {
      await api.simulateSensor(scenario);
      triggerDataRefresh();
      await loadOverview();
      showToast(t('dashboard_simulate_btn'), 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Simulation failed', 'error');
    } finally {
      streamInFlightRef.current = false;
      setSimulating(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 animate-pulse rounded-lg bg-[#E4E9E4] dark:bg-[#192A20]" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-28 rounded-xl border border-[#DCE3DD] bg-white p-5 dark:border-[#1E3126] dark:bg-[#121F18]"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-[#DC2626]/30 bg-white p-8 text-center dark:bg-[#121F18]">
        <p className="text-sm text-[#B91C1C] dark:text-[#FCA5A5]">{error || 'Unable to load telemetry'}</p>
        <button
          type="button"
          onClick={() => void loadOverview()}
          className="mt-4 rounded-lg bg-[#153625] px-4 py-2 text-xs font-semibold text-white"
        >
          {t('error_retry')}
        </button>
      </div>
    );
  }

  const { latestReading: latest, previousReading: prev, fusion, recentReadings, latestAnalysis, device } = data;
  const activeThresholds = settings.alertThresholds;
  const customBreaches = evaluateCustomThresholdAlerts(latest, activeThresholds);
  const moistureBreached = customBreaches.some((b) => b.metric === 'moisture');
  const tempBreached = customBreaches.some((b) => b.metric === 'temperature');
  const avgMoisture = Number(((latest.moistureShallow + latest.moistureDeep) / 2).toFixed(1));
  const prevAvgMoisture = prev
    ? Number(((prev.moistureShallow + prev.moistureDeep) / 2).toFixed(1))
    : avgMoisture;

  const formatDelta = (curr: number, before: number, suffix = '') => {
    const d = Number((curr - before).toFixed(1));
    if (d === 0) return `0${suffix}`;
    return `${d > 0 ? '+' : ''}${d}${suffix}`;
  };

  const chartData = recentReadings.slice(-20).map((r) => ({
    time: new Date(r.recordedAt).toLocaleTimeString([], settings.fastDemoMode
      ? { hour: '2-digit', minute: '2-digit', second: '2-digit' }
      : { hour: '2-digit', minute: '2-digit' }),
    moisture10: r.moistureShallow,
    moisture25: r.moistureDeep,
    temp: r.soilTemp,
    score: r.rootHealthScore,
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

  const summaryCards = [
    {
      id: 'health',
      label: t('metric_root_health'),
      value: String(fusion.score),
      unit: t('unit_score'),
      status: fusion.score >= 78 ? t('status_optimal') : fusion.score >= 60 ? t('status_watch') : t('status_stress'),
      statusTone: fusion.score >= 78 ? 'text-[#1E6B40] dark:text-[#6EE7A0]' : fusion.score >= 60 ? 'text-[#A16207] dark:text-[#FACC15]' : 'text-[#B91C1C] dark:text-[#F87171]',
      delta: `${fusion.trendDelta >= 0 ? '+' : ''}${fusion.trendDelta}`,
      up: fusion.trendDelta >= 0,
      onClick: () => onNavigate('ai'),
    },
    {
      id: 'risk',
      label: t('metric_disease_risk'),
      value: t(`risk_${fusion.riskLevel}`),
      unit: '',
      status: `${t('vision_confidence_label')} ${fusion.confidencePct}%`,
      statusTone: riskColorClass(fusion.riskLevel),
      delta: `${fusion.saturationHours}h wet`,
      up: fusion.riskLevel === 'low',
      onClick: () => onNavigate('advisory'),
    },
    {
      id: 'moisture',
      label: t('metric_moisture'),
      value: avgMoisture.toFixed(1),
      unit: t('unit_percent'),
      status: moistureBreached
        ? `${t('status_stress')} · ${activeThresholds.moistureMin}–${activeThresholds.moistureMax}%`
        : `${latest.moistureShallow.toFixed(0)}% / ${latest.moistureDeep.toFixed(0)}%`,
      statusTone: moistureBreached
        ? 'text-[#B91C1C] dark:text-[#F87171]'
        : 'text-[#1E6B40] dark:text-[#6EE7A0]',
      delta: formatDelta(avgMoisture, prevAvgMoisture, '%'),
      up: avgMoisture >= prevAvgMoisture,
      onClick: () => onNavigate('sensors'),
    },
    {
      id: 'temp',
      label: t('metric_temp'),
      value: latest.soilTemp.toFixed(1),
      unit: t('unit_celsius'),
      status: tempBreached
        ? `${t('status_stress')} · ${activeThresholds.tempMin}–${activeThresholds.tempMax}°C`
        : t('status_optimal'),
      statusTone: tempBreached
        ? 'text-[#B91C1C] dark:text-[#F87171]'
        : 'text-[#1E6B40] dark:text-[#6EE7A0]',
      delta: formatDelta(latest.soilTemp, prev?.soilTemp ?? latest.soilTemp, '°C'),
      up: latest.soilTemp >= (prev?.soilTemp ?? latest.soilTemp),
      onClick: () => onNavigate('sensors'),
    },
    {
      id: 'ph',
      label: t('metric_ph'),
      value: latest.soilPh.toFixed(2),
      unit: t('unit_ph'),
      status: latest.soilPh >= 5.9 && latest.soilPh <= 7.3 ? t('status_optimal') : t('status_watch'),
      statusTone: latest.soilPh >= 5.9 && latest.soilPh <= 7.3 ? 'text-[#1E6B40] dark:text-[#6EE7A0]' : 'text-[#A16207] dark:text-[#FACC15]',
      delta: formatDelta(latest.soilPh, prev?.soilPh ?? latest.soilPh),
      up: latest.soilPh >= (prev?.soilPh ?? latest.soilPh),
      onClick: () => onNavigate('sensors'),
    },
    {
      id: 'ec',
      label: t('metric_ec'),
      value: latest.soilEc.toFixed(2),
      unit: t('unit_ec'),
      status: latest.soilEc <= 2.1 ? t('status_optimal') : t('status_stress'),
      statusTone: latest.soilEc <= 2.1 ? 'text-[#1E6B40] dark:text-[#6EE7A0]' : 'text-[#B91C1C] dark:text-[#F87171]',
      delta: formatDelta(latest.soilEc, prev?.soilEc ?? latest.soilEc),
      up: latest.soilEc >= (prev?.soilEc ?? latest.soilEc),
      onClick: () => onNavigate('sensors'),
    },
    {
      id: 'growth',
      label: t('metric_root_growth'),
      value: latestAnalysis ? latestAnalysis.rootAreaPct.toFixed(1) : '24.8',
      unit: t('unit_percent'),
      status: latestAnalysis ? `${latestAnalysis.estimatedLengthCm.toFixed(0)} ${t('unit_cm')}` : '—',
      statusTone: 'text-[#2E7D4F] dark:text-[#7BE0A2]',
      delta: latestAnalysis ? `${Math.round(latestAnalysis.healthyWhitePct)}% pale` : '—',
      up: true,
      onClick: () => onNavigate('growth'),
    },
    {
      id: 'device',
      label: t('metric_device_status'),
      value: t(`status_${device.connectionStatus}`),
      unit: '',
      status: `${device.deviceId} · ${device.batteryPct}%`,
      statusTone:
        device.connectionStatus === 'simulated_online'
          ? 'text-[#1E6B40] dark:text-[#6EE7A0]'
          : 'text-[#A16207] dark:text-[#FACC15]',
      delta: `${device.wifiRssiDbm} dBm`,
      up: device.connectionStatus === 'simulated_online',
      onClick: () => onNavigate('devices'),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header & Simulation Scenario Toolbar */}
      <div className="flex flex-col justify-between gap-4 border-b border-[#DCE3DD] pb-5 lg:flex-row lg:items-end dark:border-[#1E3126]">
        <div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="text-xs font-medium text-[#8B5A2B] dark:text-[#E2B478]">
              {t('demo_mode_label')}
            </p>
            {settings.fastDemoMode && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1E6B40] dark:text-[#6EE7A0]">
                <Zap className={`h-3.5 w-3.5 transition-opacity ${liveFlash ? 'opacity-100' : 'opacity-70'}`} />
                <span>{t('dashboard_demo_stream_active')}</span>
                <span className="font-mono font-normal tabular-nums text-[#4B6155] dark:text-[#9DB4A7]">
                  · {new Date(latest.recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
                <button
                  type="button"
                  onClick={() => onNavigate('settings')}
                  className="ml-1 underline decoration-[#2E7D4F]/50 underline-offset-2 hover:text-[#153625] dark:hover:text-white"
                >
                  {t('dashboard_demo_stream_manage')}
                </button>
              </span>
            )}
          </div>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-[#122B1E] sm:text-3xl dark:text-[#F0F6F2]">
            {t('dashboard_title')}
          </h1>
          <p className="mt-1 text-sm text-[#4B6155] dark:text-[#9DB4A7]">
            {t('dashboard_subtitle')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={simulating}
            onClick={() => void handleSimulate('normal')}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#153625] px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#1E4B33] disabled:opacity-60 dark:bg-[#2E7D4F] dark:hover:bg-[#256640] whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${simulating ? 'animate-spin' : ''}`} />
            <span>{simulating ? t('dashboard_simulating') : t('dashboard_simulate_btn')}</span>
          </button>

          <button
            type="button"
            disabled={simulating}
            onClick={() => void handleSimulate('overwatered')}
            className="rounded-lg border border-[#CFD9D1] bg-white px-3 py-2 text-xs font-medium text-[#2A4034] transition-colors hover:bg-[#EDF2EE] disabled:opacity-60 dark:border-[#24382C] dark:bg-[#132119] dark:text-[#DCEEE3] whitespace-nowrap shrink-0"
          >
            {t('dashboard_scenario_wet')}
          </button>

          <button
            type="button"
            disabled={simulating}
            onClick={() => void handleSimulate('dry_stress')}
            className="rounded-lg border border-[#CFD9D1] bg-white px-3 py-2 text-xs font-medium text-[#2A4034] transition-colors hover:bg-[#EDF2EE] disabled:opacity-60 dark:border-[#24382C] dark:bg-[#132119] dark:text-[#DCEEE3] whitespace-nowrap shrink-0"
          >
            {t('dashboard_scenario_dry')}
          </button>

          <button
            type="button"
            disabled={simulating}
            onClick={() => void handleSimulate('salinity_spike')}
            className="rounded-lg border border-[#CFD9D1] bg-white px-3 py-2 text-xs font-medium text-[#2A4034] transition-colors hover:bg-[#EDF2EE] disabled:opacity-60 dark:border-[#24382C] dark:bg-[#132119] dark:text-[#DCEEE3] whitespace-nowrap shrink-0"
          >
            {t('dashboard_scenario_ec')}
          </button>
        </div>
      </div>

      {/* Custom Threshold Alerts Panel (Triggered by Settings Min/Max Limits) */}
      {customBreaches.length > 0 && (
        <section
          role="alert"
          aria-live="polite"
          className="rounded-xl border border-[#C2410C]/35 bg-[#FFF7ED] p-5 dark:border-[#FB923C]/35 dark:bg-[#24160E]"
        >
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#C2410C] dark:text-[#FB923C]" />
              <div>
                <h2 className="font-display text-base font-semibold text-[#7C2D12] dark:text-[#FDBA74]">
                  {t('dashboard_threshold_alerts_title')} ({customBreaches.length})
                </h2>
                <p className="text-xs text-[#9A3412] dark:text-[#FED7AA]">
                  {t('dashboard_threshold_alerts_subtitle')}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onNavigate('settings')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#C2410C]/35 bg-white px-3 py-1.5 text-xs font-semibold text-[#9A3412] transition-colors hover:bg-[#FFEDD5] dark:border-[#FB923C]/35 dark:bg-[#1A100B] dark:text-[#FDBA74] dark:hover:bg-[#2F1C12]"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span>{t('dashboard_threshold_adjust_btn')}</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('alerts')}
                className="inline-flex items-center gap-1 rounded-lg bg-[#9A3412] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#7C2D12] dark:bg-[#C2410C]"
              >
                <span>{t('nav_alerts')}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="mt-3.5 grid grid-cols-1 gap-2.5 md:grid-cols-2">
            {customBreaches.map((breach) => (
              <div
                key={breach.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-[#C2410C]/20 bg-white/85 px-4 py-3 dark:border-[#FB923C]/20 dark:bg-[#160F0B]/90"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[#7C2D12] dark:text-[#FDBA74]">
                    {t(breach.titleKey)}
                  </div>
                  <p className="mt-0.5 text-xs text-[#6B442E] dark:text-[#D9B8A3]">
                    {t(breach.explanationKey)}
                  </p>
                </div>
                <div className="shrink-0 text-right font-mono text-xs tabular-nums">
                  <div className="font-semibold text-[#B91C1C] dark:text-[#F87171]">
                    {breach.currentValue}
                    {breach.unit}
                  </div>
                  <div className="text-[#7C5A46] dark:text-[#C5A48F]">
                    {breach.direction === 'below' ? '<' : '>'} {breach.thresholdValue}
                    {breach.unit}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 8 Summary Cards (Single Elevation, Zero Pills, Tabular Numerals) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <button
            key={card.id}
            type="button"
            onClick={card.onClick}
            className={`group flex flex-col justify-between rounded-xl border bg-white p-5 text-left transition-colors hover:border-[#2E7D4F] dark:bg-[#121F18] dark:hover:border-[#49A06C] ${
              liveFlash && settings.fastDemoMode
                ? 'border-[#2E7D4F]/60 dark:border-[#49A06C]/70'
                : 'border-[#DCE3DD] dark:border-[#1E3126]'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-[#52685C] dark:text-[#93ACA0]">
                {card.label}
              </span>
              <span className="inline-flex items-center gap-0.5 font-mono text-xs tabular-nums text-[#5A7064] dark:text-[#8BA396]">
                {card.up ? (
                  <ArrowUpRight className="h-3.5 w-3.5 text-[#2E7D4F] dark:text-[#6EE7A0]" />
                ) : (
                  <ArrowDownRight className="h-3.5 w-3.5 text-[#B45309] dark:text-[#FBBF24]" />
                )}
                {card.delta}
              </span>
            </div>

            <div className="mt-3 flex items-baseline gap-1.5">
              <span className="font-mono text-2xl font-semibold tracking-tight tabular-nums text-[#122B1E] dark:text-white">
                {card.value}
              </span>
              {card.unit && (
                <span className="font-mono text-xs text-[#61776B] dark:text-[#8CA697]">
                  {card.unit}
                </span>
              )}
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-[#ECF0EC] pt-2.5 text-xs dark:border-[#1B2D22]">
              <span className={`font-medium ${card.statusTone}`}>{card.status}</span>
              <ArrowRight className="h-3.5 w-3.5 text-[#8FA298] transition-transform group-hover:translate-x-0.5" />
            </div>
          </button>
        ))}
      </div>

      {/* Prototype Root Health Score Breakdown & Disease-Risk Index */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Root Health Score Panel */}
        <section className="rounded-xl border border-[#DCE3DD] bg-white p-6 lg:col-span-7 dark:border-[#1E3126] dark:bg-[#121F18]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-lg font-semibold text-[#122B1E] dark:text-[#F0F6F2]">
                {t('score_section_title')}
              </h2>
              <p className="mt-1 text-xs text-[#6B5440] dark:text-[#D5B08B]">
                {t('score_prototype_notice')}
              </p>
            </div>
            <div className="text-right">
              <div className="font-mono text-4xl font-bold tabular-nums text-[#153625] dark:text-[#7BE0A2]">
                {fusion.score}
                <span className="text-base font-normal text-[#61776B] dark:text-[#8CA697]">/100</span>
              </div>
            </div>
          </div>

          {/* Clean horizontal score progress bar */}
          <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-[#E8EDE9] dark:bg-[#1B2C22]">
            <div
              className="h-full rounded-full bg-[#2E7D4F] transition-all duration-300 dark:bg-[#59C17D]"
              style={{ width: `${fusion.score}%` }}
            />
          </div>

          {/* Contributing Factors List */}
          <div className="mt-5 divide-y divide-[#ECF0EC] dark:divide-[#1B2D22]">
            {fusion.factors.map((factor) => (
              <div key={factor.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <span className="font-medium text-[#1F352A] dark:text-[#DCEAE1]">
                    {t(factor.labelKey)}
                  </span>
                  <span className="ml-2 font-mono text-xs tabular-nums text-[#5D7367] dark:text-[#8CA697]">
                    {factor.valueDisplay}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`text-xs font-semibold ${factorColorClass(factor.status)}`}>
                    {t(`status_${factor.status}`)}
                  </span>
                  <span className="w-10 text-right font-mono text-xs tabular-nums text-[#5A7064] dark:text-[#8BA396]">
                    {factor.impactPoints === 0 ? '0' : factor.impactPoints}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Disease-Risk Index Panel */}
        <section className="flex flex-col justify-between rounded-xl border border-[#DCE3DD] bg-white p-6 lg:col-span-5 dark:border-[#1E3126] dark:bg-[#121F18]">
          <div>
            <h2 className="font-display text-lg font-semibold text-[#122B1E] dark:text-[#F0F6F2]">
              {t('risk_section_title')}
            </h2>
            <p className="mt-1 text-xs text-[#6B5440] dark:text-[#D5B08B]">
              {t('risk_cautious_notice')}
            </p>

            {/* 4-tier Risk Scale */}
            <div className="mt-5 grid grid-cols-4 gap-1.5">
              {(['low', 'moderate', 'elevated', 'high'] as RiskLevel[]).map((level) => {
                const active = fusion.riskLevel === level;
                return (
                  <div
                    key={level}
                    className={`rounded-lg border px-2 py-2.5 text-center text-xs font-semibold ${
                      active
                        ? 'border-[#153625] bg-[#153625] text-white dark:border-[#49A06C] dark:bg-[#235439]'
                        : 'border-[#E2E8E3] bg-[#F7F8F5] text-[#667B6F] dark:border-[#1E3126] dark:bg-[#0E1813] dark:text-[#7E9689]'
                    }`}
                  >
                    {t(`risk_${level}`)}
                  </div>
                );
              })}
            </div>

            <div className="mt-5 space-y-3 border-t border-[#ECF0EC] pt-4 text-sm dark:border-[#1B2D22]">
              <div className="flex items-center justify-between">
                <span className="text-[#4B6155] dark:text-[#9DB4A7]">{t('risk_confidence_label')}</span>
                <span className="font-mono font-semibold tabular-nums text-[#122B1E] dark:text-white">
                  {fusion.dataQualityPct}% / {fusion.confidencePct}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#4B6155] dark:text-[#9DB4A7]">{t('risk_saturation_label')}</span>
                <span className="font-mono font-semibold tabular-nums text-[#122B1E] dark:text-white">
                  {fusion.saturationHours} h
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#4B6155] dark:text-[#9DB4A7]">{t('risk_drying_rate_label')}</span>
                <span className="font-mono font-semibold tabular-nums text-[#122B1E] dark:text-white">
                  {fusion.dryingRatePerHour} %/h
                </span>
              </div>
            </div>

            {fusion.ruleTriggers.length > 0 && (
              <div className="mt-4 border-t border-[#ECF0EC] pt-4 dark:border-[#1B2D22]">
                <div className="text-xs font-semibold text-[#5C4033] dark:text-[#E2B478]">
                  {t('ai_triggered_rules')}
                </div>
                <ul className="mt-2 space-y-1.5 text-xs text-[#3C5246] dark:text-[#B4C8BC]">
                  {fusion.ruleTriggers.map((ruleKey) => (
                    <li key={ruleKey}>· {t(ruleKey)}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="mt-6 flex flex-wrap gap-2 border-t border-[#ECF0EC] pt-4 dark:border-[#1B2D22]">
            <button
              type="button"
              onClick={() => onNavigate('advisory')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#153625] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#1E4B33] dark:bg-[#2E7D4F]"
            >
              <span>{t('nav_advisory')}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('vision')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#CFD9D1] px-3.5 py-2 text-xs font-semibold text-[#153625] hover:bg-[#EDF2EE] dark:border-[#24382C] dark:text-[#DCEEE3] dark:hover:bg-[#1A2D22]"
            >
              <span>{t('nav_vision')}</span>
            </button>
          </div>
        </section>
      </div>

      {/* Interactive Recharts Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-[#DCE3DD] bg-white p-6 dark:border-[#1E3126] dark:bg-[#121F18]">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-base font-semibold text-[#122B1E] dark:text-[#F0F6F2]">
              {t('chart_moisture_temp')}
            </h2>
            <span className="font-mono text-xs tabular-nums text-[#5A7064] dark:text-[#8BA396]">
              {t('dashboard_threshold_active_band')}: {activeThresholds.moistureMin}–{activeThresholds.moistureMax}% · {activeThresholds.tempMin}–{activeThresholds.tempMax}°C
            </span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis dataKey="time" stroke={axisColor} tick={{ fontSize: 11 }} />
                <YAxis stroke={axisColor} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <ReferenceLine
                  y={activeThresholds.moistureMax}
                  stroke="#C2410C"
                  strokeDasharray="4 4"
                  strokeOpacity={0.55}
                />
                <ReferenceLine
                  y={activeThresholds.moistureMin}
                  stroke="#C2410C"
                  strokeDasharray="4 4"
                  strokeOpacity={0.55}
                />
                <Line
                  type="monotone"
                  dataKey="moisture10"
                  name={t('sensors_shallow_label')}
                  stroke="#2E7D4F"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={!settings.fastDemoMode}
                />
                <Line
                  type="monotone"
                  dataKey="moisture25"
                  name={t('sensors_deep_label')}
                  stroke="#0E7490"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={!settings.fastDemoMode}
                />
                <Line
                  type="monotone"
                  dataKey="temp"
                  name={t('metric_temp')}
                  stroke="#C26A2D"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={!settings.fastDemoMode}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-xl border border-[#DCE3DD] bg-white p-6 dark:border-[#1E3126] dark:bg-[#121F18]">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="font-display text-base font-semibold text-[#122B1E] dark:text-[#F0F6F2]">
              {t('chart_health_history')}
            </h2>
            <span className="font-mono text-xs text-[#5A7064] dark:text-[#8BA396]">
              0 – 100
            </span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2E7D4F" stopOpacity={0.32} />
                    <stop offset="95%" stopColor="#2E7D4F" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis dataKey="time" stroke={axisColor} tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} stroke={axisColor} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area
                  type="monotone"
                  dataKey="score"
                  name={t('metric_root_health')}
                  stroke="#2E7D4F"
                  strokeWidth={2.2}
                  fill="url(#scoreGrad)"
                  isAnimationActive={!settings.fastDemoMode}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </div>
  );
}
