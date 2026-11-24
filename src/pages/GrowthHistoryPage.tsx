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
import type { RootAnalysisRecord } from '../types/rootwatch';

export function GrowthHistoryPage() {
  const { t, theme, refreshTick } = useApp();
  const [analyses, setAnalyses] = useState<RootAnalysisRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [beforeId, setBeforeId] = useState<number | null>(null);
  const [afterId, setAfterId] = useState<number | null>(null);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const { analyses: list } = await api.getRootAnalyses();
      // Chronological oldest -> newest for trend charts
      const chronological = [...list].reverse();
      setAnalyses(chronological);
      if (chronological.length >= 2) {
        setBeforeId((prev) => prev ?? chronological[0].id);
        setAfterId((prev) => prev ?? chronological[chronological.length - 1].id);
      } else if (chronological.length === 1) {
        setBeforeId(chronological[0].id);
        setAfterId(chronological[0].id);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory, refreshTick]);

  const beforeImg = analyses.find((a) => a.id === beforeId) ?? analyses[0];
  const afterImg = analyses.find((a) => a.id === afterId) ?? analyses[analyses.length - 1];

  const chartData = analyses.map((a) => ({
    date: new Date(a.capturedAt).toLocaleDateString([], { month: 'short', day: 'numeric' }),
    area: a.rootAreaPct,
    length: a.estimatedLengthCm,
    health: a.rootHealthEstimate,
    whitePct: a.healthyWhitePct,
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

  const formatDiff = (a: number, b: number, unit: string) => {
    const d = Number((b - a).toFixed(1));
    return `${d >= 0 ? '+' : ''}${d}${unit}`;
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-[#DCE3DD] pb-5 dark:border-[#1E3126]">
        <h1 className="font-display text-2xl font-bold tracking-tight text-[#122B1E] sm:text-3xl dark:text-[#F0F6F2]">
          {t('growth_title')}
        </h1>
        <p className="mt-1 text-sm text-[#4B6155] dark:text-[#9DB4A7]">{t('growth_subtitle')}</p>
      </div>

      {loading ? (
        <div className="rounded-xl border border-[#DCE3DD] bg-white p-8 text-sm text-[#5A7064] dark:border-[#1E3126] dark:bg-[#121F18]">
          {t('loading_text')}
        </div>
      ) : analyses.length === 0 ? (
        <div className="rounded-xl border border-[#DCE3DD] bg-white p-8 text-sm text-[#5A7064] dark:border-[#1E3126] dark:bg-[#121F18]">
          No root captures saved yet.
        </div>
      ) : (
        <>
          {/* Side-by-Side Image Comparison */}
          <section className="rounded-xl border border-[#DCE3DD] bg-white p-6 dark:border-[#1E3126] dark:bg-[#121F18]">
            <h2 className="font-display text-lg font-semibold text-[#122B1E] dark:text-[#F0F6F2]">
              {t('growth_compare_title')}
            </h2>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="compare-before"
                  className="block text-xs font-medium text-[#4B6155] dark:text-[#9DB4A7]"
                >
                  {t('growth_select_before')}
                </label>
                <select
                  id="compare-before"
                  value={beforeImg?.id ?? ''}
                  onChange={(e) => setBeforeId(Number(e.target.value))}
                  className="mt-1.5 w-full rounded-lg border border-[#CFD9D1] bg-[#FAFBF9] px-3 py-2 text-sm text-[#122B1E] dark:border-[#253B2F] dark:bg-[#0E1813] dark:text-white"
                >
                  {analyses.map((a) => (
                    <option key={a.id} value={a.id}>
                      {new Date(a.capturedAt).toLocaleDateString()} — {a.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="compare-after"
                  className="block text-xs font-medium text-[#4B6155] dark:text-[#9DB4A7]"
                >
                  {t('growth_select_after')}
                </label>
                <select
                  id="compare-after"
                  value={afterImg?.id ?? ''}
                  onChange={(e) => setAfterId(Number(e.target.value))}
                  className="mt-1.5 w-full rounded-lg border border-[#CFD9D1] bg-[#FAFBF9] px-3 py-2 text-sm text-[#122B1E] dark:border-[#253B2F] dark:bg-[#0E1813] dark:text-white"
                >
                  {analyses.map((a) => (
                    <option key={a.id} value={a.id}>
                      {new Date(a.capturedAt).toLocaleDateString()} — {a.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {beforeImg && afterImg && (
              <>
                <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
                  {[beforeImg, afterImg].map((item, idx) => (
                    <div key={`${item.id}-${idx}`} className="space-y-2.5">
                      <img
                        src={item.imageUrl}
                        alt={item.label}
                        referrerPolicy="no-referrer"
                        className="aspect-[4/3] w-full rounded-lg border border-[#DCE3DD] object-cover dark:border-[#1E3126]"
                      />
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-[#122B1E] dark:text-[#EDF4EF]">
                          {item.label}
                        </span>
                        <span className="font-mono tabular-nums text-[#5A7064] dark:text-[#8BA396]">
                          {new Date(item.capturedAt).toLocaleDateString()} · {t(`source_${item.source}`)}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs tabular-nums text-[#4B6155] dark:text-[#9DB4A7]">
                        <span>Area: {item.rootAreaPct}%</span>
                        <span>Length: {item.estimatedLengthCm} cm</span>
                        <span>Pale: {item.healthyWhitePct}%</span>
                        <span>Score: {item.rootHealthEstimate}/100</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Comparison Deltas Strip */}
                <div className="mt-6 grid grid-cols-2 gap-4 border-t border-[#ECF0EC] pt-5 sm:grid-cols-4 dark:border-[#1B2D22]">
                  <div>
                    <div className="text-xs text-[#5A7064] dark:text-[#8BA396]">
                      {t('growth_delta_area')}
                    </div>
                    <div className="mt-1 font-mono text-lg font-bold tabular-nums text-[#122B1E] dark:text-white">
                      {formatDiff(beforeImg.rootAreaPct, afterImg.rootAreaPct, '%')}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-[#5A7064] dark:text-[#8BA396]">
                      {t('growth_delta_length')}
                    </div>
                    <div className="mt-1 font-mono text-lg font-bold tabular-nums text-[#122B1E] dark:text-white">
                      {formatDiff(beforeImg.estimatedLengthCm, afterImg.estimatedLengthCm, ' cm')}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-[#5A7064] dark:text-[#8BA396]">
                      {t('growth_delta_white')}
                    </div>
                    <div className="mt-1 font-mono text-lg font-bold tabular-nums text-[#122B1E] dark:text-white">
                      {formatDiff(beforeImg.healthyWhitePct, afterImg.healthyWhitePct, '%')}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-[#5A7064] dark:text-[#8BA396]">
                      {t('growth_delta_score')}
                    </div>
                    <div className="mt-1 font-mono text-lg font-bold tabular-nums text-[#122B1E] dark:text-white">
                      {formatDiff(beforeImg.rootHealthEstimate, afterImg.rootHealthEstimate, '')}
                    </div>
                  </div>
                </div>
              </>
            )}
          </section>

          {/* Historical Root Growth & Score Charts */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <section className="rounded-xl border border-[#DCE3DD] bg-white p-6 dark:border-[#1E3126] dark:bg-[#121F18]">
              <h2 className="mb-4 font-display text-base font-semibold text-[#122B1E] dark:text-[#F0F6F2]">
                {t('chart_root_growth')}
              </h2>
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 8, right: 10, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                    <XAxis dataKey="date" stroke={axisColor} tick={{ fontSize: 11 }} />
                    <YAxis stroke={axisColor} tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line
                      type="monotone"
                      dataKey="area"
                      name={`${t('vision_area_label')} (%)`}
                      stroke="#2E7D4F"
                      strokeWidth={2.2}
                    />
                    <Line
                      type="monotone"
                      dataKey="length"
                      name={`${t('vision_length_label')} (cm)`}
                      stroke="#8B5A2B"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="rounded-xl border border-[#DCE3DD] bg-white p-6 dark:border-[#1E3126] dark:bg-[#121F18]">
              <h2 className="mb-4 font-display text-base font-semibold text-[#122B1E] dark:text-[#F0F6F2]">
                {t('chart_health_history')} &amp; {t('vision_legend_healthy')}
              </h2>
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 8, right: 10, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                    <XAxis dataKey="date" stroke={axisColor} tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} stroke={axisColor} tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line
                      type="monotone"
                      dataKey="health"
                      name={t('metric_root_health')}
                      stroke="#153625"
                      strokeWidth={2.2}
                    />
                    <Line
                      type="monotone"
                      dataKey="whitePct"
                      name={`${t('vision_legend_healthy')} (%)`}
                      stroke="#38A169"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>

          {/* Chronological Timeline List */}
          <section className="rounded-xl border border-[#DCE3DD] bg-white p-6 dark:border-[#1E3126] dark:bg-[#121F18]">
            <h2 className="font-display text-base font-semibold text-[#122B1E] dark:text-[#F0F6F2]">
              {t('growth_timeline_title')}
            </h2>
            <div className="mt-4 divide-y divide-[#ECF0EC] dark:divide-[#1B2D22]">
              {[...analyses].reverse().map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-4">
                    <img
                      src={item.imageUrl}
                      alt={item.label}
                      referrerPolicy="no-referrer"
                      className="h-16 w-20 shrink-0 rounded-lg border border-[#DCE3DD] object-cover dark:border-[#1E3126]"
                    />
                    <div>
                      <div className="font-semibold text-[#122B1E] dark:text-[#EDF4EF]">
                        {item.label}
                      </div>
                      <div className="mt-0.5 text-xs text-[#5A7064] dark:text-[#8BA396]">
                        {new Date(item.capturedAt).toLocaleString()} · {t(`source_${item.source}`)}
                      </div>
                      <p className="mt-1 text-xs text-[#3C5246] dark:text-[#B4C8BC]">
                        {t(item.summaryKey)}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-4 font-mono text-xs tabular-nums text-[#2A4034] sm:text-right dark:text-[#C5DACD]">
                    <div>
                      <div className="text-[#5A7064] dark:text-[#8BA396]">Area</div>
                      <div className="font-semibold">{item.rootAreaPct}%</div>
                    </div>
                    <div>
                      <div className="text-[#5A7064] dark:text-[#8BA396]">Score</div>
                      <div className="font-semibold">{item.rootHealthEstimate}/100</div>
                    </div>
                    <div>
                      <div className="text-[#5A7064] dark:text-[#8BA396]">Stress</div>
                      <div className="font-semibold">{t(`risk_${item.stressIndicatorLevel}`)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
