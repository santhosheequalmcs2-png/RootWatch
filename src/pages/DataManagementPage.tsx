import { Download, Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '../i18n/LanguageContext';
import { api } from '../lib/api';
import type { AlertItem, RootAnalysisRecord, SensorReading } from '../types/rootwatch';

type TableTab = 'sensors' | 'analyses' | 'alerts';

export function DataManagementPage() {
  const { t, refreshTick } = useApp();
  const [activeTab, setActiveTab] = useState<TableTab>('sensors');
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'demo' | 'user'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(true);

  const [sensors, setSensors] = useState<SensorReading[]>([]);
  const [analyses, setAnalyses] = useState<RootAnalysisRecord[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getDataRecords();
      setSensors(res.sensors);
      setAnalyses(res.analyses);
      setAlerts(res.alerts);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll, refreshTick]);

  const matchesCommon = useCallback(
    (isoDate: string, source: string, textBlob: string) => {
      if (sourceFilter === 'demo' && source !== 'demo') return false;
      if (sourceFilter === 'user' && source === 'demo') return false;
      if (dateFrom && isoDate.slice(0, 10) < dateFrom) return false;
      if (dateTo && isoDate.slice(0, 10) > dateTo) return false;
      if (search.trim() && !textBlob.toLowerCase().includes(search.trim().toLowerCase())) {
        return false;
      }
      return true;
    },
    [sourceFilter, dateFrom, dateTo, search],
  );

  const filteredSensors = useMemo(
    () =>
      sensors.filter((r) =>
        matchesCommon(
          r.recordedAt,
          r.source,
          `${r.deviceId} ${r.riskLevel} ${r.source} ${r.notes ?? ''}`,
        ),
      ),
    [sensors, matchesCommon],
  );

  const filteredAnalyses = useMemo(
    () =>
      analyses.filter((a) =>
        matchesCommon(
          a.capturedAt,
          a.source,
          `${a.deviceId} ${a.label} ${a.stressIndicatorLevel} ${a.source}`,
        ),
      ),
    [analyses, matchesCommon],
  );

  const filteredAlerts = useMemo(
    () =>
      alerts.filter((a) =>
        matchesCommon(
          a.createdAt,
          a.source,
          `${a.deviceId} ${a.category} ${a.severity} ${a.metricContext} ${a.source}`,
        ),
      ),
    [alerts, matchesCommon],
  );

  const activeCount =
    activeTab === 'sensors'
      ? filteredSensors.length
      : activeTab === 'analyses'
        ? filteredAnalyses.length
        : filteredAlerts.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 border-b border-[#DCE3DD] pb-5 lg:flex-row lg:items-end dark:border-[#1E3126]">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#122B1E] sm:text-3xl dark:text-[#F0F6F2]">
            {t('data_title')}
          </h1>
          <p className="mt-1 text-sm text-[#4B6155] dark:text-[#9DB4A7]">{t('data_subtitle')}</p>
        </div>

        <a
          href={`/api/export/csv?table=${activeTab}`}
          download
          className="inline-flex items-center gap-1.5 self-start rounded-lg bg-[#153625] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#1E4B33] lg:self-auto dark:bg-[#2E7D4F] whitespace-nowrap shrink-0"
        >
          <Download className="h-3.5 w-3.5" />
          <span>{t('data_export_csv')}</span>
        </a>
      </div>

      {/* Tabs + Search / Filter Toolbar */}
      <div className="flex flex-col gap-3 rounded-xl border border-[#DCE3DD] bg-white p-4 dark:border-[#1E3126] dark:bg-[#121F18]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            role="tablist"
            aria-label="Data records category"
            className="inline-flex rounded-lg border border-[#CFD9D1] bg-[#EDF1EC] p-0.5 dark:border-[#24382C] dark:bg-[#0E1813]"
          >
            {(
              [
                ['sensors', 'data_tab_sensors'],
                ['analyses', 'data_tab_analyses'],
                ['alerts', 'data_tab_alerts'],
              ] as const
            ).map(([tab, labelKey]) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={activeTab === tab}
                onClick={() => setActiveTab(tab)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                  activeTab === tab
                    ? 'bg-white text-[#122B1E] shadow-sm dark:bg-[#235439] dark:text-white'
                    : 'text-[#4B6155] dark:text-[#98B2A4]'
                }`}
              >
                {t(labelKey)}
              </button>
            ))}
          </div>

          <span className="font-mono text-xs tabular-nums text-[#5A7064] dark:text-[#8BA396]">
            {activeCount} {t('data_records_count')}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-[#738A7D]" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('data_search_placeholder')}
              aria-label={t('data_search_placeholder')}
              className="w-full rounded-lg border border-[#CFD9D1] bg-[#FAFBF9] py-2 pr-3 pl-9 text-xs text-[#122B1E] focus:border-[#2E7D4F] focus:outline-none dark:border-[#253B2F] dark:bg-[#0E1813] dark:text-white"
            />
          </div>

          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as 'all' | 'demo' | 'user')}
            aria-label="Filter data source"
            className="rounded-lg border border-[#CFD9D1] bg-[#FAFBF9] px-3 py-2 text-xs text-[#122B1E] dark:border-[#253B2F] dark:bg-[#0E1813] dark:text-white"
          >
            <option value="all">{t('data_source_all')}</option>
            <option value="demo">{t('data_source_demo')}</option>
            <option value="user">{t('data_source_user')}</option>
          </select>

          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            aria-label={t('data_date_from')}
            className="rounded-lg border border-[#CFD9D1] bg-[#FAFBF9] px-3 py-2 font-mono text-xs text-[#122B1E] dark:border-[#253B2F] dark:bg-[#0E1813] dark:text-white"
          />

          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            aria-label={t('data_date_to')}
            className="rounded-lg border border-[#CFD9D1] bg-[#FAFBF9] px-3 py-2 font-mono text-xs text-[#122B1E] dark:border-[#253B2F] dark:bg-[#0E1813] dark:text-white"
          />
        </div>
      </div>

      {/* Tabular Data Grid */}
      <div className="overflow-x-auto rounded-xl border border-[#DCE3DD] bg-white dark:border-[#1E3126] dark:bg-[#121F18]">
        {loading ? (
          <div className="p-8 text-sm text-[#5A7064] dark:text-[#8BA396]">{t('loading_text')}</div>
        ) : activeCount === 0 ? (
          <div className="p-8 text-center text-sm text-[#5A7064] dark:text-[#8BA396]">
            {t('data_empty')}
          </div>
        ) : activeTab === 'sensors' ? (
          <table className="w-full min-w-[780px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-[#DCE3DD] bg-[#F4F6F2] text-[#4B6155] dark:border-[#1E3126] dark:bg-[#0E1813] dark:text-[#93ACA0]">
                <th className="px-4 py-3 font-semibold">Timestamp</th>
                <th className="px-4 py-3 font-semibold">Source</th>
                <th className="px-4 py-3 text-right font-semibold">10cm %</th>
                <th className="px-4 py-3 text-right font-semibold">25cm %</th>
                <th className="px-4 py-3 text-right font-semibold">Temp °C</th>
                <th className="px-4 py-3 text-right font-semibold">pH</th>
                <th className="px-4 py-3 text-right font-semibold">EC</th>
                <th className="px-4 py-3 text-right font-semibold">Score</th>
                <th className="px-4 py-3 font-semibold">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ECF0EC] dark:divide-[#1B2D22]">
              {filteredSensors.slice(0, 60).map((row) => (
                <tr key={row.id} className="hover:bg-[#F7F9F6] dark:hover:bg-[#16261D]">
                  <td className="px-4 py-2.5 font-mono tabular-nums text-[#2A4034] dark:text-[#C5DACD]">
                    {new Date(row.recordedAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-[#8B5A2B] dark:text-[#E2B478]">
                    {t(`source_${row.source}`)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums">{row.moistureShallow}</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums">{row.moistureDeep}</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums">{row.soilTemp}</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums">{row.soilPh}</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums">{row.soilEc}</td>
                  <td className="px-4 py-2.5 text-right font-mono font-semibold tabular-nums text-[#153625] dark:text-[#7BE0A2]">
                    {row.rootHealthScore}
                  </td>
                  <td className="max-w-[220px] truncate px-4 py-2.5 text-[#5A7064] dark:text-[#8BA396]">
                    {row.notes || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : activeTab === 'analyses' ? (
          <table className="w-full min-w-[720px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-[#DCE3DD] bg-[#F4F6F2] text-[#4B6155] dark:border-[#1E3126] dark:bg-[#0E1813] dark:text-[#93ACA0]">
                <th className="px-4 py-3 font-semibold">Captured At</th>
                <th className="px-4 py-3 font-semibold">Label</th>
                <th className="px-4 py-3 font-semibold">Source</th>
                <th className="px-4 py-3 text-right font-semibold">Area %</th>
                <th className="px-4 py-3 text-right font-semibold">Length cm</th>
                <th className="px-4 py-3 text-right font-semibold">Pale %</th>
                <th className="px-4 py-3 text-right font-semibold">Dark %</th>
                <th className="px-4 py-3 text-right font-semibold">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ECF0EC] dark:divide-[#1B2D22]">
              {filteredAnalyses.map((row) => (
                <tr key={row.id} className="hover:bg-[#F7F9F6] dark:hover:bg-[#16261D]">
                  <td className="px-4 py-2.5 font-mono tabular-nums">
                    {new Date(row.capturedAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-[#122B1E] dark:text-white">{row.label}</td>
                  <td className="px-4 py-2.5 text-[#8B5A2B] dark:text-[#E2B478]">
                    {t(`source_${row.source}`)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums">{row.rootAreaPct}</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums">{row.estimatedLengthCm}</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums">{row.healthyWhitePct}</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums">{row.darkBrownPct}</td>
                  <td className="px-4 py-2.5 text-right font-mono font-semibold tabular-nums text-[#153625] dark:text-[#7BE0A2]">
                    {row.rootHealthEstimate}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full min-w-[700px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-[#DCE3DD] bg-[#F4F6F2] text-[#4B6155] dark:border-[#1E3126] dark:bg-[#0E1813] dark:text-[#93ACA0]">
                <th className="px-4 py-3 font-semibold">Created At</th>
                <th className="px-4 py-3 font-semibold">Category</th>
                <th className="px-4 py-3 font-semibold">Severity</th>
                <th className="px-4 py-3 font-semibold">Details</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ECF0EC] dark:divide-[#1B2D22]">
              {filteredAlerts.map((row) => (
                <tr key={row.id} className="hover:bg-[#F7F9F6] dark:hover:bg-[#16261D]">
                  <td className="px-4 py-2.5 font-mono tabular-nums">
                    {new Date(row.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5">{t(`alerts_cat_${row.category}`)}</td>
                  <td className="px-4 py-2.5 font-semibold">{t(`risk_${row.severity}`)}</td>
                  <td className="max-w-[280px] truncate px-4 py-2.5">{row.metricContext}</td>
                  <td className="px-4 py-2.5">
                    {row.acknowledged ? t('alerts_acked_label') : t('alerts_active_label')}
                  </td>
                  <td className="px-4 py-2.5 text-[#8B5A2B] dark:text-[#E2B478]">
                    {t(`source_${row.source}`)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
