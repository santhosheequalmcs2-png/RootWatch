import { ArrowRight } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useApp } from '../i18n/LanguageContext';
import { generateAdvisories } from '../lib/analytics';
import { api } from '../lib/api';
import type { AdvisoryItem, OverviewResponse, PageId } from '../types/rootwatch';

interface AdvisoryPageProps {
  onNavigate: (page: PageId) => void;
}

export function AdvisoryPage({ onNavigate }: AdvisoryPageProps) {
  const { t, refreshTick } = useApp();
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [advisories, setAdvisories] = useState<AdvisoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const ov = await api.getOverview();
      setOverview(ov);
      setAdvisories(generateAdvisories(ov.latestReading, ov.fusion, ov.latestAnalysis));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData, refreshTick]);

  const priorityTone = (p: AdvisoryItem['priority']) => {
    if (p === 'high') return 'text-[#B91C1C] dark:text-[#F87171]';
    if (p === 'medium') return 'text-[#A16207] dark:text-[#FACC15]';
    return 'text-[#1E6B40] dark:text-[#6EE7A0]';
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-[#DCE3DD] pb-5 dark:border-[#1E3126]">
        <h1 className="font-display text-2xl font-bold tracking-tight text-[#122B1E] sm:text-3xl dark:text-[#F0F6F2]">
          {t('advisory_title')}
        </h1>
        <p className="mt-1 text-sm text-[#4B6155] dark:text-[#9DB4A7]">{t('advisory_subtitle')}</p>
        <p className="mt-3 rounded-lg border border-[#D8CEBF] bg-[#FAF6EE] px-4 py-2.5 text-xs leading-relaxed text-[#6E4722] dark:border-[#3A2E20] dark:bg-[#1C1812] dark:text-[#E5BD8A]">
          {t('advisory_safety_note')}
        </p>
      </div>

      {loading ? (
        <div className="rounded-xl border border-[#DCE3DD] bg-white p-8 text-sm text-[#5A7064] dark:border-[#1E3126] dark:bg-[#121F18]">
          {t('loading_text')}
        </div>
      ) : (
        <>
          {overview && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#DCE3DD] bg-[#F2F5F0] px-5 py-3.5 text-xs text-[#3C5246] dark:border-[#1E3126] dark:bg-[#101C16] dark:text-[#B4C8BC]">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span>
                  {t('metric_root_health')}:{' '}
                  <strong className="font-mono tabular-nums text-[#122B1E] dark:text-white">
                    {overview.fusion.score}/100
                  </strong>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  {t('metric_disease_risk')}:{' '}
                  <strong className="text-[#122B1E] dark:text-white">
                    {t(`risk_${overview.fusion.riskLevel}`)}
                  </strong>
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  {overview.latestReading.moistureShallow}% / {overview.latestReading.moistureDeep}% ·{' '}
                  {overview.latestReading.soilTemp}°C
                </span>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('dashboard')}
                className="inline-flex items-center gap-1 font-semibold text-[#2E7D4F] hover:text-[#153625] dark:text-[#7BE0A2]"
              >
                <span>{t('nav_dashboard')}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <div className="space-y-4">
            {advisories.map((adv) => (
              <article
                key={adv.id}
                className="rounded-xl border border-[#DCE3DD] bg-white p-6 dark:border-[#1E3126] dark:bg-[#121F18]"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className={`font-semibold ${priorityTone(adv.priority)}`}>
                    {t(`advisory_priority_${adv.priority}`)}
                  </span>
                  <span className="font-mono tabular-nums text-[#5A7064] dark:text-[#8BA396]">
                    {new Date(adv.generatedAt).toLocaleString()}
                  </span>
                </div>

                <h2 className="mt-2 font-display text-lg font-semibold text-[#122B1E] dark:text-[#EDF4EF]">
                  {t(adv.titleKey)}
                </h2>

                <div className="mt-4 grid grid-cols-1 gap-4 border-t border-[#ECF0EC] pt-4 md:grid-cols-2 dark:border-[#1B2D22]">
                  <div>
                    <div className="text-xs font-semibold text-[#5A7064] dark:text-[#8BA396]">
                      {t('advisory_why_label')}
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-[#354B3F] dark:text-[#B9CEC2]">
                      {t(adv.reasonKey)}
                    </p>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-[#5A7064] dark:text-[#8BA396]">
                      {t('advisory_next_label')}
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-[#153625] dark:text-[#DCF0E4]">
                      {t(adv.actionKey)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 text-xs text-[#5A7064] dark:text-[#8BA396]">
                  <span>{t('advisory_evidence_label')}: </span>
                  <span className="font-mono tabular-nums text-[#2A4034] dark:text-[#C5DACD]">
                    {adv.metricEvidence}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
