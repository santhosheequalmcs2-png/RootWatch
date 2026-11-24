import { ArrowRight, Download, Droplets, RotateCcw, Save, SlidersHorizontal, Thermometer, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useApp } from '../i18n/LanguageContext';
import { DEFAULT_ALERT_THRESHOLDS } from '../lib/analytics';
import type { PageId } from '../types/rootwatch';

interface SettingsPageProps {
  onNavigate?: (page: PageId) => void;
}

export function SettingsPage({ onNavigate }: SettingsPageProps) {
  const { language, setLanguage, theme, setTheme, settings, updateAppSettings, t, showToast } =
    useApp();
  const [calNote, setCalNote] = useState(settings.calibrationNote);
  const [savingNote, setSavingNote] = useState(false);

  const [moistureMin, setMoistureMin] = useState(String(settings.alertThresholds.moistureMin));
  const [moistureMax, setMoistureMax] = useState(String(settings.alertThresholds.moistureMax));
  const [tempMin, setTempMin] = useState(String(settings.alertThresholds.tempMin));
  const [tempMax, setTempMax] = useState(String(settings.alertThresholds.tempMax));
  const [savingThresholds, setSavingThresholds] = useState(false);

  useEffect(() => {
    setCalNote(settings.calibrationNote);
  }, [settings.calibrationNote]);

  useEffect(() => {
    setMoistureMin(String(settings.alertThresholds.moistureMin));
    setMoistureMax(String(settings.alertThresholds.moistureMax));
    setTempMin(String(settings.alertThresholds.tempMin));
    setTempMax(String(settings.alertThresholds.tempMax));
  }, [settings.alertThresholds]);

  const parsedMoistureMin = Number(moistureMin);
  const parsedMoistureMax = Number(moistureMax);
  const parsedTempMin = Number(tempMin);
  const parsedTempMax = Number(tempMax);

  const thresholdsValid =
    moistureMin.trim() !== '' &&
    moistureMax.trim() !== '' &&
    tempMin.trim() !== '' &&
    tempMax.trim() !== '' &&
    Number.isFinite(parsedMoistureMin) &&
    Number.isFinite(parsedMoistureMax) &&
    Number.isFinite(parsedTempMin) &&
    Number.isFinite(parsedTempMax) &&
    parsedMoistureMin >= 0 &&
    parsedMoistureMax <= 100 &&
    parsedMoistureMin < parsedMoistureMax &&
    parsedTempMin >= 0 &&
    parsedTempMax <= 60 &&
    parsedTempMin < parsedTempMax;

  const handleSaveThresholds = async () => {
    if (!thresholdsValid) return;
    setSavingThresholds(true);
    try {
      await updateAppSettings({
        alertThresholds: {
          moistureMin: Number(parsedMoistureMin.toFixed(1)),
          moistureMax: Number(parsedMoistureMax.toFixed(1)),
          tempMin: Number(parsedTempMin.toFixed(1)),
          tempMax: Number(parsedTempMax.toFixed(1)),
        },
      });
      showToast(t('settings_thresholds_saved'), 'success');
    } finally {
      setSavingThresholds(false);
    }
  };

  const handleResetThresholds = async () => {
    setSavingThresholds(true);
    try {
      await updateAppSettings({
        alertThresholds: { ...DEFAULT_ALERT_THRESHOLDS },
      });
      showToast(t('settings_thresholds_reset_toast'), 'success');
    } finally {
      setSavingThresholds(false);
    }
  };

  const handleSaveCalibration = async () => {
    setSavingNote(true);
    try {
      await updateAppSettings({ calibrationNote: calNote });
      showToast(t('settings_saved'), 'success');
    } finally {
      setSavingNote(false);
    }
  };

  const handleToggleFastDemo = () => {
    const next = !settings.fastDemoMode;
    void updateAppSettings({ fastDemoMode: next });
    showToast(
      next ? t('settings_demo_mode_enabled_toast') : t('settings_demo_mode_disabled_toast'),
      'success',
    );
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-[#DCE3DD] pb-5 dark:border-[#1E3126]">
        <h1 className="font-display text-2xl font-bold tracking-tight text-[#122B1E] sm:text-3xl dark:text-[#F0F6F2]">
          {t('settings_title')}
        </h1>
        <p className="mt-1 text-sm text-[#4B6155] dark:text-[#9DB4A7]">{t('settings_subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Language & Theme */}
        <section className="space-y-5 rounded-xl border border-[#DCE3DD] bg-white p-6 dark:border-[#1E3126] dark:bg-[#121F18]">
          <div>
            <h2 className="font-display text-base font-semibold text-[#122B1E] dark:text-[#F0F6F2]">
              {t('settings_lang_title')}
            </h2>
            <p className="mt-1 text-xs text-[#4B6155] dark:text-[#9DB4A7]">
              {t('settings_lang_desc')}
            </p>
            <div className="mt-3 inline-flex rounded-lg border border-[#CFD9D1] bg-[#EDF1EC] p-1 dark:border-[#24382C] dark:bg-[#0E1813]">
              <button
                type="button"
                onClick={() => setLanguage('en')}
                aria-pressed={language === 'en'}
                className={`rounded-md px-4 py-1.5 text-xs font-semibold transition-colors ${
                  language === 'en'
                    ? 'bg-white text-[#122B1E] shadow-sm dark:bg-[#235439] dark:text-white'
                    : 'text-[#4B6155] dark:text-[#98B2A4]'
                }`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => setLanguage('ta')}
                aria-pressed={language === 'ta'}
                className={`rounded-md px-4 py-1.5 text-xs font-semibold transition-colors ${
                  language === 'ta'
                    ? 'bg-white text-[#122B1E] shadow-sm dark:bg-[#235439] dark:text-white'
                    : 'text-[#4B6155] dark:text-[#98B2A4]'
                }`}
              >
                தமிழ் (Tamil)
              </button>
            </div>
          </div>

          <div className="border-t border-[#ECF0EC] pt-5 dark:border-[#1B2D22]">
            <h2 className="font-display text-base font-semibold text-[#122B1E] dark:text-[#F0F6F2]">
              {t('settings_theme_title')}
            </h2>
            <p className="mt-1 text-xs text-[#4B6155] dark:text-[#9DB4A7]">
              {t('settings_theme_desc')}
            </p>
            <div className="mt-3 inline-flex rounded-lg border border-[#CFD9D1] bg-[#EDF1EC] p-1 dark:border-[#24382C] dark:bg-[#0E1813]">
              <button
                type="button"
                onClick={() => setTheme('light')}
                aria-pressed={theme === 'light'}
                className={`rounded-md px-4 py-1.5 text-xs font-semibold transition-colors ${
                  theme === 'light'
                    ? 'bg-white text-[#122B1E] shadow-sm dark:bg-[#235439] dark:text-white'
                    : 'text-[#4B6155] dark:text-[#98B2A4]'
                }`}
              >
                {t('settings_theme_light')}
              </button>
              <button
                type="button"
                onClick={() => setTheme('dark')}
                aria-pressed={theme === 'dark'}
                className={`rounded-md px-4 py-1.5 text-xs font-semibold transition-colors ${
                  theme === 'dark'
                    ? 'bg-white text-[#122B1E] shadow-sm dark:bg-[#235439] dark:text-white'
                    : 'text-[#4B6155] dark:text-[#98B2A4]'
                }`}
              >
                {t('settings_theme_dark')}
              </button>
            </div>
          </div>
        </section>

        {/* Notifications & Simulation Settings */}
        <section className="space-y-4 rounded-xl border border-[#DCE3DD] bg-white p-6 dark:border-[#1E3126] dark:bg-[#121F18]">
          <h2 className="font-display text-base font-semibold text-[#122B1E] dark:text-[#F0F6F2]">
            {t('settings_notif_title')}
          </h2>

          {/* Demo Mode Fast Real-Time Simulation Toggle */}
          <div
            className={`rounded-lg border p-4 transition-colors ${
              settings.fastDemoMode
                ? 'border-[#2E7D4F] bg-[#F1F8F3] dark:border-[#49A06C] dark:bg-[#152B1F]'
                : 'border-[#DCE3DD] bg-[#F9FAF7] dark:border-[#1E3126] dark:bg-[#0E1813]'
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Zap
                    className={`h-4 w-4 shrink-0 ${
                      settings.fastDemoMode
                        ? 'text-[#2E7D4F] dark:text-[#6EE7A0]'
                        : 'text-[#5A7064] dark:text-[#8BA396]'
                    }`}
                  />
                  <span className="font-display text-sm font-semibold text-[#122B1E] dark:text-[#F0F6F2]">
                    {t('settings_demo_mode_title')}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-[#4B6155] dark:text-[#9DB4A7]">
                  {t('settings_demo_mode_desc')}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <span
                    className={`font-mono text-xs font-medium ${
                      settings.fastDemoMode
                        ? 'text-[#1E6B40] dark:text-[#6EE7A0]'
                        : 'text-[#61776B] dark:text-[#8CA697]'
                    }`}
                  >
                    {settings.fastDemoMode
                      ? t('settings_demo_mode_on')
                      : t('settings_demo_mode_off')}
                  </span>
                  {settings.fastDemoMode && onNavigate && (
                    <button
                      type="button"
                      onClick={() => onNavigate('dashboard')}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#153625] underline decoration-[#2E7D4F]/50 underline-offset-2 hover:text-[#2E7D4F] dark:text-[#7BE0A2]"
                    >
                      <span>{t('settings_demo_mode_view_dashboard')}</span>
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={settings.fastDemoMode}
                aria-label={t('settings_demo_mode_title')}
                onClick={handleToggleFastDemo}
                className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2E7D4F] ${
                  settings.fastDemoMode
                    ? 'bg-[#2E7D4F] dark:bg-[#49A06C]'
                    : 'bg-[#CBD5CE] dark:bg-[#273C30]'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                    settings.fastDemoMode ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {[
            {
              key: 'notifyAlerts' as const,
              label: t('settings_notif_alerts'),
              checked: settings.notifyAlerts,
            },
            {
              key: 'notifyCalibration' as const,
              label: t('settings_notif_cal'),
              checked: settings.notifyCalibration,
            },
            {
              key: 'autoSimulate' as const,
              label: t('settings_auto_sim'),
              checked: settings.autoSimulate,
            },
          ].map((item) => (
            <label
              key={item.key}
              className="flex cursor-pointer items-center justify-between gap-4 border-t border-[#ECF0EC] pt-3.5 text-sm text-[#2A4034] dark:border-[#1B2D22] dark:text-[#C5DACD]"
            >
              <span>{item.label}</span>
              <input
                type="checkbox"
                checked={item.checked}
                onChange={(e) => {
                  void updateAppSettings({ [item.key]: e.target.checked });
                  showToast(t('settings_saved'), 'success');
                }}
                className="h-4 w-4 accent-[#2E7D4F]"
              />
            </label>
          ))}

          <div className="border-t border-[#ECF0EC] pt-4 dark:border-[#1B2D22]">
            <div className="text-xs font-semibold text-[#4B6155] dark:text-[#9DB4A7]">
              {t('data_export_csv')}
            </div>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {(['sensors', 'analyses', 'alerts'] as const).map((tbl) => (
                <a
                  key={tbl}
                  href={`/api/export/csv?table=${tbl}`}
                  download
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#CFD9D1] px-3 py-1.5 text-xs font-semibold text-[#153625] hover:bg-[#EDF2EE] dark:border-[#24382C] dark:text-[#DCEEE3] dark:hover:bg-[#192B21]"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>{t(`data_tab_${tbl}`)}</span>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* Custom Alert Thresholds */}
        <section className="rounded-xl border border-[#DCE3DD] bg-white p-6 lg:col-span-2 dark:border-[#1E3126] dark:bg-[#121F18]">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
            <div>
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-[#2E7D4F] dark:text-[#6EE7A0]" />
                <h2 className="font-display text-base font-semibold text-[#122B1E] dark:text-[#F0F6F2]">
                  {t('settings_thresholds_title')}
                </h2>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-[#4B6155] dark:text-[#9DB4A7]">
                {t('settings_thresholds_desc')}
              </p>
            </div>
            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('dashboard')}
                className="inline-flex items-center gap-1 self-start text-xs font-semibold text-[#153625] underline decoration-[#2E7D4F]/50 underline-offset-2 hover:text-[#2E7D4F] dark:text-[#7BE0A2] whitespace-nowrap"
              >
                <span>{t('nav_dashboard')}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
            {/* Soil Moisture Min/Max */}
            <div className="rounded-lg border border-[#E2E8E3] bg-[#FAFBF9] p-4 dark:border-[#1E3126] dark:bg-[#0E1813]">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#122B1E] dark:text-[#F0F6F2]">
                  <Droplets className="h-4 w-4 text-[#2E7D4F] dark:text-[#6EE7A0]" />
                  <span>{t('settings_thresholds_moisture_label')}</span>
                </div>
                <span className="font-mono text-xs tabular-nums text-[#5A7064] dark:text-[#8BA396]">
                  {settings.alertThresholds.moistureMin}% – {settings.alertThresholds.moistureMax}%
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-[#4B6155] dark:text-[#9DB4A7]">
                    {t('settings_thresholds_min')} (%)
                  </span>
                  <input
                    id="threshold-moisture-min"
                    type="number"
                    min={0}
                    max={95}
                    step={1}
                    value={moistureMin}
                    onChange={(e) => setMoistureMin(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[#CFD9D1] bg-white px-3 py-2 font-mono text-sm tabular-nums text-[#122B1E] focus:border-[#2E7D4F] focus:outline-none dark:border-[#253B2F] dark:bg-[#121F18] dark:text-white"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-[#4B6155] dark:text-[#9DB4A7]">
                    {t('settings_thresholds_max')} (%)
                  </span>
                  <input
                    id="threshold-moisture-max"
                    type="number"
                    min={5}
                    max={100}
                    step={1}
                    value={moistureMax}
                    onChange={(e) => setMoistureMax(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[#CFD9D1] bg-white px-3 py-2 font-mono text-sm tabular-nums text-[#122B1E] focus:border-[#2E7D4F] focus:outline-none dark:border-[#253B2F] dark:bg-[#121F18] dark:text-white"
                  />
                </label>
              </div>
            </div>

            {/* Soil Temperature Min/Max */}
            <div className="rounded-lg border border-[#E2E8E3] bg-[#FAFBF9] p-4 dark:border-[#1E3126] dark:bg-[#0E1813]">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#122B1E] dark:text-[#F0F6F2]">
                  <Thermometer className="h-4 w-4 text-[#C26A2D] dark:text-[#F5A86E]" />
                  <span>{t('settings_thresholds_temp_label')}</span>
                </div>
                <span className="font-mono text-xs tabular-nums text-[#5A7064] dark:text-[#8BA396]">
                  {settings.alertThresholds.tempMin}°C – {settings.alertThresholds.tempMax}°C
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-[#4B6155] dark:text-[#9DB4A7]">
                    {t('settings_thresholds_min')} (°C)
                  </span>
                  <input
                    id="threshold-temp-min"
                    type="number"
                    min={0}
                    max={50}
                    step={0.5}
                    value={tempMin}
                    onChange={(e) => setTempMin(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[#CFD9D1] bg-white px-3 py-2 font-mono text-sm tabular-nums text-[#122B1E] focus:border-[#2E7D4F] focus:outline-none dark:border-[#253B2F] dark:bg-[#121F18] dark:text-white"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-[#4B6155] dark:text-[#9DB4A7]">
                    {t('settings_thresholds_max')} (°C)
                  </span>
                  <input
                    id="threshold-temp-max"
                    type="number"
                    min={5}
                    max={60}
                    step={0.5}
                    value={tempMax}
                    onChange={(e) => setTempMax(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[#CFD9D1] bg-white px-3 py-2 font-mono text-sm tabular-nums text-[#122B1E] focus:border-[#2E7D4F] focus:outline-none dark:border-[#253B2F] dark:bg-[#121F18] dark:text-white"
                  />
                </label>
              </div>
            </div>
          </div>

          {!thresholdsValid && (
            <p role="alert" className="mt-3 text-xs font-medium text-[#B91C1C] dark:text-[#FCA5A5]">
              {t('settings_thresholds_invalid')}
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              disabled={!thresholdsValid || savingThresholds}
              onClick={() => void handleSaveThresholds()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#153625] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#1E4B33] disabled:opacity-50 dark:bg-[#2E7D4F] dark:hover:bg-[#256640]"
            >
              <Save className="h-3.5 w-3.5" />
              <span>{t('settings_thresholds_save')}</span>
            </button>
            <button
              type="button"
              disabled={savingThresholds}
              onClick={() => void handleResetThresholds()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#CFD9D1] px-3.5 py-2 text-xs font-semibold text-[#2A4034] transition-colors hover:bg-[#EDF2EE] disabled:opacity-50 dark:border-[#24382C] dark:text-[#DCEEE3] dark:hover:bg-[#192B21]"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>{t('settings_thresholds_reset')}</span>
            </button>
          </div>
        </section>

        {/* Calibration Reference Log */}
        <section className="rounded-xl border border-[#DCE3DD] bg-white p-6 dark:border-[#1E3126] dark:bg-[#121F18]">
          <h2 className="font-display text-base font-semibold text-[#122B1E] dark:text-[#F0F6F2]">
            {t('settings_cal_title')}
          </h2>
          <label htmlFor="calibration-note" className="sr-only">
            {t('settings_cal_title')}
          </label>
          <textarea
            id="calibration-note"
            rows={4}
            value={calNote}
            onChange={(e) => setCalNote(e.target.value)}
            className="mt-3 w-full rounded-lg border border-[#CFD9D1] bg-[#FAFBF9] p-3 text-xs text-[#122B1E] focus:border-[#2E7D4F] focus:outline-none dark:border-[#253B2F] dark:bg-[#0E1813] dark:text-white"
          />
          <button
            type="button"
            disabled={savingNote}
            onClick={() => void handleSaveCalibration()}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#153625] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1E4B33] disabled:opacity-60 dark:bg-[#2E7D4F]"
          >
            <Save className="h-3.5 w-3.5" />
            <span>{t('settings_cal_save')}</span>
          </button>
        </section>

        {/* About RootWatch */}
        <section className="rounded-xl border border-[#DCE3DD] bg-[#F3F4EF] p-6 dark:border-[#1E3126] dark:bg-[#101C16]">
          <h2 className="font-display text-base font-semibold text-[#122B1E] dark:text-[#F0F6F2]">
            {t('settings_about_title')}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[#3C5246] dark:text-[#B4C8BC]">
            {t('settings_about_desc')}
          </p>
          <div className="mt-4 space-y-1 text-xs text-[#5A7064] dark:text-[#8BA396]">
            <div>{t('tagline')}</div>
            <div>{t('demo_mode_label')}</div>
          </div>
        </section>
      </div>
    </div>
  );
}
