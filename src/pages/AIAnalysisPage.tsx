import { RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '../i18n/LanguageContext';
import { computeRootHealthFusion } from '../lib/analytics';
import { api } from '../lib/api';
import type { SensorReading } from '../types/rootwatch';

export function AIAnalysisPage() {
  const { t, refreshTick } = useApp();
  const [history, setHistory] = useState<SensorReading[]>([]);
  const [moistureShallow, setMoistureShallow] = useState(56);
  const [moistureDeep, setMoistureDeep] = useState(61);
  const [soilTemp, setSoilTemp] = useState(26.2);
  const [soilPh, setSoilPh] = useState(6.6);
  const [soilEc, setSoilEc] = useState(1.45);
  const [rootImpedance, setRootImpedance] = useState(18.5);
  const [darkRootPct, setDarkRootPct] = useState(11);

  const syncWithLatest = useCallback(async () => {
    try {
      const ov = await api.getOverview();
      setHistory(ov.recentReadings);
      setMoistureShallow(ov.latestReading.moistureShallow);
      setMoistureDeep(ov.latestReading.moistureDeep);
      setSoilTemp(ov.latestReading.soilTemp);
      setSoilPh(ov.latestReading.soilPh);
      setSoilEc(ov.latestReading.soilEc);
      setRootImpedance(ov.latestReading.rootImpedance);
      if (ov.latestAnalysis) {
        setDarkRootPct(Math.round(ov.latestAnalysis.darkBrownPct));
      }
    } catch {
      // Keep default simulator sliders
    }
  }, []);

  useEffect(() => {
    void syncWithLatest();
  }, [syncWithLatest, refreshTick]);

  const fusion = useMemo(() => {
    return computeRootHealthFusion(
      {
        moistureShallow,
        moistureDeep,
        soilTemp,
        soilPh,
        soilEc,
        rootImpedance,
        recordedAt: new Date().toISOString(),
      },
      history,
      {
        healthyWhitePct: Math.max(5, 86 - darkRootPct),
        darkBrownPct: darkRootPct,
        imageQualityScore: 84,
        rootAreaPct: 24,
      },
    );
  }, [moistureShallow, moistureDeep, soilTemp, soilPh, soilEc, rootImpedance, darkRootPct, history]);

  const layers = [
    {
      num: '01',
      title: t('ai_layer1_title'),
      desc: t('ai_layer1_desc'),
      meta: 'Moisture · Temp · EC · pH · Saturation Duration',
    },
    {
      num: '02',
      title: t('ai_layer2_title'),
      desc: t('ai_layer2_desc'),
      meta: 'Random Forest / XGBoost Feature Vector Ready',
    },
    {
      num: '03',
      title: t('ai_layer3_title'),
      desc: t('ai_layer3_desc'),
      meta: 'Segmentation · Area · Color · Growth Delta',
    },
    {
      num: '04',
      title: t('ai_layer4_title'),
      desc: t('ai_layer4_desc'),
      meta: 'Prototype Score 0–100 · Risk Band · Data Quality',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="border-b border-[#DCE3DD] pb-5 dark:border-[#1E3126]">
        <h1 className="font-display text-2xl font-bold tracking-tight text-[#122B1E] sm:text-3xl dark:text-[#F0F6F2]">
          {t('ai_title')}
        </h1>
        <p className="mt-1 text-sm text-[#4B6155] dark:text-[#9DB4A7]">{t('ai_subtitle')}</p>
        <p className="mt-3 rounded-lg border border-[#D8CEBF] bg-[#FAF6EE] px-4 py-2.5 text-xs leading-relaxed text-[#6E4722] dark:border-[#3A2E20] dark:bg-[#1C1812] dark:text-[#E5BD8A]">
          {t('ai_honesty_banner')}
        </p>
      </div>

      {/* 4-Layer Architecture Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {layers.map((layer) => (
          <div
            key={layer.num}
            className="rounded-xl border border-[#DCE3DD] bg-white p-5 dark:border-[#1E3126] dark:bg-[#121F18]"
          >
            <div className="flex items-center justify-between gap-2 font-mono text-xs text-[#2E7D4F] dark:text-[#7BE0A2]">
              <span>Layer {layer.num}</span>
              <span className="text-[#5A7064] dark:text-[#8BA396]">{layer.meta}</span>
            </div>
            <h2 className="mt-2 font-display text-base font-semibold text-[#122B1E] dark:text-[#EDF4EF]">
              {layer.title}
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-[#4B6155] dark:text-[#9DB4A7]">
              {layer.desc}
            </p>
          </div>
        ))}
      </div>

      {/* Interactive Layer 1 + Layer 4 What-If Fusion Simulator */}
      <section className="grid grid-cols-1 gap-6 rounded-xl border border-[#DCE3DD] bg-white p-6 lg:grid-cols-12 dark:border-[#1E3126] dark:bg-[#121F18]">
        <div className="space-y-4 lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-lg font-semibold text-[#122B1E] dark:text-[#F0F6F2]">
                {t('ai_sandbox_title')}
              </h2>
              <p className="mt-0.5 text-xs text-[#5A7064] dark:text-[#8BA396]">
                {t('ai_sandbox_desc')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void syncWithLatest()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#CFD9D1] px-3 py-1.5 text-xs font-semibold text-[#153625] hover:bg-[#EDF2EE] dark:border-[#24382C] dark:text-[#DCEEE3] whitespace-nowrap"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>{t('ai_reset_live')}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[
              {
                id: 'sim-m10',
                label: t('sensors_shallow_label'),
                value: moistureShallow,
                unit: '%',
                min: 10,
                max: 95,
                step: 1,
                onChange: setMoistureShallow,
              },
              {
                id: 'sim-m25',
                label: t('sensors_deep_label'),
                value: moistureDeep,
                unit: '%',
                min: 10,
                max: 95,
                step: 1,
                onChange: setMoistureDeep,
              },
              {
                id: 'sim-temp',
                label: t('metric_temp'),
                value: soilTemp,
                unit: '°C',
                min: 12,
                max: 40,
                step: 0.5,
                onChange: setSoilTemp,
              },
              {
                id: 'sim-ph',
                label: t('metric_ph'),
                value: soilPh,
                unit: 'pH',
                min: 4.5,
                max: 8.8,
                step: 0.1,
                onChange: setSoilPh,
              },
              {
                id: 'sim-ec',
                label: t('metric_ec'),
                value: soilEc,
                unit: 'mS/cm',
                min: 0.2,
                max: 3.8,
                step: 0.05,
                onChange: setSoilEc,
              },
              {
                id: 'sim-imp',
                label: t('sensors_impedance_label'),
                value: rootImpedance,
                unit: 'kΩ',
                min: 5,
                max: 42,
                step: 0.5,
                onChange: setRootImpedance,
              },
              {
                id: 'sim-dark',
                label: t('vision_legend_dark'),
                value: darkRootPct,
                unit: '%',
                min: 0,
                max: 50,
                step: 1,
                onChange: setDarkRootPct,
              },
            ].map((ctrl) => (
              <div key={ctrl.id}>
                <div className="flex items-center justify-between text-xs">
                  <label htmlFor={ctrl.id} className="font-medium text-[#2A4034] dark:text-[#C5DACD]">
                    {ctrl.label}
                  </label>
                  <span className="font-mono font-semibold tabular-nums text-[#122B1E] dark:text-white">
                    {ctrl.value} {ctrl.unit}
                  </span>
                </div>
                <input
                  id={ctrl.id}
                  type="range"
                  min={ctrl.min}
                  max={ctrl.max}
                  step={ctrl.step}
                  value={ctrl.value}
                  onChange={(e) => ctrl.onChange(Number(e.target.value))}
                  className="mt-1.5 h-1.5 w-full accent-[#2E7D4F]"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Live Data Fusion Output Panel */}
        <div className="flex flex-col justify-between rounded-xl border border-[#E2E8E3] bg-[#F7F8F5] p-5 lg:col-span-5 dark:border-[#1E3126] dark:bg-[#0E1813]">
          <div>
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-semibold text-[#5A7064] dark:text-[#8BA396]">
                {t('metric_root_health')}
              </span>
              <span className="font-mono text-3xl font-bold tabular-nums text-[#153625] dark:text-[#7BE0A2]">
                {fusion.score}/100
              </span>
            </div>

            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-[#4B6155] dark:text-[#9DB4A7]">{t('metric_disease_risk')}</span>
              <span className="font-semibold text-[#122B1E] dark:text-white">
                {t(`risk_${fusion.riskLevel}`)}
              </span>
            </div>

            <div className="mt-2 flex items-center justify-between text-xs text-[#5A7064] dark:text-[#8BA396]">
              <span>{t('risk_confidence_label')}</span>
              <span className="font-mono tabular-nums">
                {fusion.dataQualityPct}% · {fusion.confidencePct}%
              </span>
            </div>

            <div className="mt-5 border-t border-[#DCE3DD] pt-4 dark:border-[#1E3126]">
              <div className="text-xs font-semibold text-[#122B1E] dark:text-[#EDF4EF]">
                {t('ai_triggered_rules')}
              </div>
              {fusion.ruleTriggers.length === 0 ? (
                <p className="mt-2 text-xs text-[#2E7D4F] dark:text-[#7BE0A2]">
                  {t('ai_no_rules')}
                </p>
              ) : (
                <ul className="mt-2 space-y-1.5 text-xs text-[#8B4513] dark:text-[#F4B47B]">
                  {fusion.ruleTriggers.map((key) => (
                    <li key={key}>· {t(key)}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <p className="mt-5 border-t border-[#DCE3DD] pt-3 text-[11px] leading-relaxed text-[#5A7064] dark:border-[#1E3126] dark:text-[#8BA396]">
            {t('score_prototype_notice')}
          </p>
        </div>
      </section>
    </div>
  );
}
