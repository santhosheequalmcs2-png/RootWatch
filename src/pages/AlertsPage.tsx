import { Check, CheckCircle2, Send } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useApp } from '../i18n/LanguageContext';
import { api } from '../lib/api';
import type { AlertCategory, AlertItem, AlertSeverity } from '../types/rootwatch';

export function AlertsPage() {
  const { t, refreshTick, triggerDataRefresh, showToast } = useApp();
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'ack'>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | AlertCategory>('all');
  const [ackPendingId, setAckPendingId] = useState<number | null>(null);

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const { alerts: list } = await api.getAlerts();
      setAlerts(list);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAlerts();
  }, [loadAlerts, refreshTick]);

  const handleAcknowledge = async (id: number) => {
    setAckPendingId(id);
    try {
      const { alert } = await api.acknowledgeAlert(id);
      setAlerts((prev) => prev.map((a) => (a.id === id ? alert : a)));
      triggerDataRefresh();
      showToast(t('alerts_acked_label'), 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to acknowledge alert', 'error');
    } finally {
      setAckPendingId(null);
    }
  };

  const filtered = alerts.filter((a) => {
    if (statusFilter === 'active' && a.acknowledged) return false;
    if (statusFilter === 'ack' && !a.acknowledged) return false;
    if (categoryFilter !== 'all' && a.category !== categoryFilter) return false;
    return true;
  });

  const severityColor = (sev: AlertSeverity) => {
    if (sev === 'high') return 'text-[#B91C1C] dark:text-[#F87171]';
    if (sev === 'elevated') return 'text-[#C2410C] dark:text-[#FB923C]';
    if (sev === 'moderate') return 'text-[#A16207] dark:text-[#FACC15]';
    return 'text-[#1E6B40] dark:text-[#6EE7A0]';
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-[#DCE3DD] pb-5 dark:border-[#1E3126]">
        <h1 className="font-display text-2xl font-bold tracking-tight text-[#122B1E] sm:text-3xl dark:text-[#F0F6F2]">
          {t('alerts_title')}
        </h1>
        <p className="mt-1 text-sm text-[#4B6155] dark:text-[#9DB4A7]">{t('alerts_subtitle')}</p>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="group"
          aria-label="Alert status filter"
          className="inline-flex rounded-lg border border-[#CFD9D1] bg-[#EDF1EC] p-1 dark:border-[#24382C] dark:bg-[#101C16]"
        >
          {(
            [
              ['all', 'alerts_filter_all'],
              ['active', 'alerts_filter_active'],
              ['ack', 'alerts_filter_ack'],
            ] as const
          ).map(([val, labelKey]) => (
            <button
              key={val}
              type="button"
              onClick={() => setStatusFilter(val)}
              aria-pressed={statusFilter === val}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                statusFilter === val
                  ? 'bg-white text-[#122B1E] shadow-sm dark:bg-[#235439] dark:text-white'
                  : 'text-[#4B6155] dark:text-[#98B2A4]'
              }`}
            >
              {t(labelKey)}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 text-xs text-[#4B6155] dark:text-[#9DB4A7]">
          <span className="sr-only">Filter by alert category</span>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as 'all' | AlertCategory)}
            aria-label="Alert category filter"
            className="rounded-lg border border-[#CFD9D1] bg-white px-3 py-2 text-xs font-medium text-[#122B1E] dark:border-[#24382C] dark:bg-[#121F18] dark:text-white"
          >
            <option value="all">{t('alerts_filter_all')}</option>
            <option value="stress">{t('alerts_cat_stress')}</option>
            <option value="root_change">{t('alerts_cat_root_change')}</option>
            <option value="sensor_anomaly">{t('alerts_cat_sensor_anomaly')}</option>
            <option value="calibration">{t('alerts_cat_calibration')}</option>
            <option value="device_offline">{t('alerts_cat_device_offline')}</option>
          </select>
        </label>
      </div>

      {/* Alert List */}
      {loading ? (
        <div className="rounded-xl border border-[#DCE3DD] bg-white p-8 text-sm text-[#5A7064] dark:border-[#1E3126] dark:bg-[#121F18]">
          {t('loading_text')}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-[#DCE3DD] bg-white p-8 text-center text-sm text-[#5A7064] dark:border-[#1E3126] dark:bg-[#121F18]">
          {t('alerts_empty')}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((alert) => (
            <div
              key={alert.id}
              className="flex flex-col justify-between gap-4 rounded-xl border border-[#DCE3DD] bg-white p-5 sm:flex-row sm:items-center dark:border-[#1E3126] dark:bg-[#121F18]"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  <span className={`font-semibold ${severityColor(alert.severity)}`}>
                    {t(`risk_${alert.severity}`)}
                  </span>
                  <span aria-hidden="true" className="text-[#9FB0A6]">·</span>
                  <span className="text-[#4B6155] dark:text-[#9DB4A7]">
                    {t(`alerts_cat_${alert.category}`)}
                  </span>
                  <span aria-hidden="true" className="text-[#9FB0A6]">·</span>
                  <span className="font-mono tabular-nums text-[#5A7064] dark:text-[#8BA396]">
                    {new Date(alert.createdAt).toLocaleString()}
                  </span>
                  <span aria-hidden="true" className="text-[#9FB0A6]">·</span>
                  <span className="text-[#5A7064] dark:text-[#8BA396]">
                    {t(`source_${alert.source}`)}
                  </span>
                </div>

                <h2 className="mt-1.5 font-display text-base font-semibold text-[#122B1E] dark:text-[#EDF4EF]">
                  {t(alert.titleKey)}
                </h2>
                <p className="mt-1 text-sm text-[#43594D] dark:text-[#A9BFB2]">
                  {t(alert.explanationKey)}
                </p>
                <div className="mt-2 font-mono text-xs tabular-nums text-[#5A7064] dark:text-[#8BA396]">
                  {alert.metricContext}
                </div>
              </div>

              <div className="shrink-0">
                {alert.acknowledged ? (
                  <div className="inline-flex items-center gap-1.5 text-xs font-medium text-[#2E7D4F] dark:text-[#7BE0A2]">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>{t('alerts_acked_label')}</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={ackPendingId === alert.id}
                    onClick={() => void handleAcknowledge(alert.id)}
                    aria-label={`${t('alerts_ack_btn')} ${t(alert.titleKey)}`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#153625] px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#1E4B33] disabled:opacity-60 dark:bg-[#2E7D4F] whitespace-nowrap"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>{t('alerts_ack_btn')}</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Future Telegram Integration Architecture Panel */}
      <section className="rounded-xl border border-[#DCE3DD] bg-[#F3F4EF] p-6 dark:border-[#1E3126] dark:bg-[#101C16]">
        <div className="flex items-start gap-3">
          <Send className="mt-0.5 h-5 w-5 shrink-0 text-[#2E7D4F] dark:text-[#7BE0A2]" />
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-base font-semibold text-[#122B1E] dark:text-[#EDF4EF]">
              {t('alerts_telegram_title')}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-[#4B6155] dark:text-[#9DB4A7]">
              {t('alerts_telegram_desc')}
            </p>
            <div className="mt-3 font-mono text-xs text-[#8B5A2B] dark:text-[#E2B478]">
              {t('alerts_telegram_status')}
            </div>
            <pre className="mt-3 overflow-x-auto rounded-lg border border-[#DCE3DD] bg-white p-3 font-mono text-[11px] text-[#2A4034] dark:border-[#1E3126] dark:bg-[#0C1410] dark:text-[#B9CEC2]">
{`# Planned Server-Side Telegram Webhook Dispatcher (server.ts)
# Requires server env: TELEGRAM_BOT_TOKEN & TELEGRAM_CHAT_ID
POST https://api.telegram.org/bot<TOKEN>/sendMessage
{ "chat_id": "<CHAT_ID>", "text": "[RootWatch] Potential Moisture Stress · RW-TN-001" }`}
            </pre>
          </div>
        </div>
      </section>
    </div>
  );
}
