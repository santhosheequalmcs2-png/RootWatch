import { CheckCircle2, Layers, Save, Sparkles, Upload } from 'lucide-react';
import React, { useRef, useState } from 'react';
import { SAMPLE_ROOT_IMAGES } from '../data/samples';
import { useApp } from '../i18n/LanguageContext';
import { api } from '../lib/api';
import { analyzeRootImagePrototype, type VisionSegmentationOutput } from '../lib/rootVision';

const MAX_FILE_BYTES = 4.5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

export function RootVisionPage() {
  const { t, triggerDataRefresh, showToast } = useApp();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedImageUrl, setSelectedImageUrl] = useState<string>(SAMPLE_ROOT_IMAGES[0].imageUrl);
  const [captureLabel, setCaptureLabel] = useState<string>('Healthy Baseline Capture');
  const [isUserUpload, setIsUserUpload] = useState<boolean>(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [viewMode, setViewMode] = useState<'original' | 'overlay' | 'split'>('split');
  const [result, setResult] = useState<VisionSegmentationOutput | null>(null);

  const handleFile = (file: File) => {
    setUploadError('');
    setSavedSuccess(false);
    if (!ALLOWED_TYPES.includes(file.type)) {
      setUploadError('Unsupported format. Please upload a PNG, JPG, or WEBP root image.');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setUploadError('Image exceeds 4.5 MB limit. Please choose a smaller file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setSelectedImageUrl(reader.result);
        setCaptureLabel(file.name.replace(/\.[^.]+$/, '').slice(0, 60) || 'Uploaded Root Frame');
        setIsUserUpload(true);
        setResult(null);
      }
    };
    reader.onerror = () => {
      setUploadError('Could not read the selected image file.');
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleRunAnalysis = async () => {
    setAnalyzing(true);
    setUploadError('');
    setSavedSuccess(false);
    try {
      const output = await analyzeRootImagePrototype(selectedImageUrl);
      setResult(output);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Image analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSaveToHistory = async () => {
    if (!result) return;
    setSaving(true);
    try {
      await api.saveRootAnalysis({
        label: captureLabel.trim() || 'Root Capture',
        imageUrl: selectedImageUrl,
        rootAreaPct: result.rootAreaPct,
        estimatedLengthCm: result.estimatedLengthCm,
        healthyWhitePct: result.healthyWhitePct,
        tanOchrePct: result.tanOchrePct,
        darkBrownPct: result.darkBrownPct,
        imageQualityScore: result.imageQualityScore,
        qualityLabel: result.qualityLabel,
        stressIndicatorLevel: result.stressIndicatorLevel,
        rootHealthEstimate: result.rootHealthEstimate,
        confidencePct: result.confidencePct,
        summaryKey: result.summaryKey,
        source: isUserUpload ? 'user' : 'demo',
      });
      setSavedSuccess(true);
      triggerDataRefresh();
      showToast(t('vision_saved_msg'), 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save analysis', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-[#DCE3DD] pb-5 dark:border-[#1E3126]">
        <p className="text-xs font-medium text-[#8B5A2B] dark:text-[#E2B478]">
          {t('demo_mode_label')}
        </p>
        <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-[#122B1E] sm:text-3xl dark:text-[#F0F6F2]">
          {t('vision_title')}
        </h1>
        <p className="mt-1 text-sm text-[#4B6155] dark:text-[#9DB4A7]">{t('vision_subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Upload Dropzone & Sample Picker */}
        <section className="space-y-5 lg:col-span-5">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            className={`rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
              dragActive
                ? 'border-[#2E7D4F] bg-[#EAF3EC] dark:bg-[#173023]'
                : 'border-[#C9D5CB] bg-white dark:border-[#24382C] dark:bg-[#121F18]'
            }`}
          >
            <Upload className="mx-auto h-7 w-7 text-[#2E7D4F] dark:text-[#7BE0A2]" />
            <p className="mt-3 text-sm font-semibold text-[#122B1E] dark:text-[#EDF4EF]">
              {t('vision_upload_title')}
            </p>
            <p className="mt-1 text-xs text-[#5A7064] dark:text-[#8BA396]">
              {t('vision_upload_hint')}
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
              className="sr-only"
              id="root-image-file-input"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-4 rounded-lg border border-[#B9C8BD] bg-[#F8F9F6] px-4 py-2 text-xs font-semibold text-[#153625] transition-colors hover:bg-[#EAF0EB] dark:border-[#2C4738] dark:bg-[#182B21] dark:text-[#E5F2EA]"
            >
              {t('vision_choose_file')}
            </button>

            {uploadError && (
              <p className="mt-3 text-xs font-medium text-[#B91C1C] dark:text-[#FCA5A5]">
                {uploadError}
              </p>
            )}
          </div>

          {/* Built-in Demo Sample Picker */}
          <div className="rounded-xl border border-[#DCE3DD] bg-white p-5 dark:border-[#1E3126] dark:bg-[#121F18]">
            <h2 className="text-xs font-semibold text-[#4B6155] dark:text-[#9DB4A7]">
              {t('vision_samples_title')}
            </h2>
            <div className="mt-3 space-y-2.5">
              {SAMPLE_ROOT_IMAGES.map((sample) => {
                const active = selectedImageUrl === sample.imageUrl;
                return (
                  <button
                    key={sample.id}
                    type="button"
                    onClick={() => {
                      setSelectedImageUrl(sample.imageUrl);
                      setCaptureLabel(t(sample.labelKey));
                      setIsUserUpload(false);
                      setResult(null);
                      setSavedSuccess(false);
                      setUploadError('');
                    }}
                    className={`flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition-colors ${
                      active
                        ? 'border-[#2E7D4F] bg-[#EDF5EF] dark:border-[#59C17D] dark:bg-[#173023]'
                        : 'border-[#E3EAE4] hover:border-[#B6C7BA] dark:border-[#1E3126] dark:hover:border-[#304D3D]'
                    }`}
                  >
                    <img
                      src={sample.imageUrl}
                      alt={t(sample.labelKey)}
                      referrerPolicy="no-referrer"
                      className="h-14 w-16 shrink-0 rounded-md object-cover"
                    />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-[#122B1E] dark:text-[#EDF4EF]">
                        {t(sample.labelKey)}
                      </div>
                      <div className="truncate text-xs text-[#5A7064] dark:text-[#8BA396]">
                        {t(sample.stageKey)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Capture Label & Action */}
          <div className="rounded-xl border border-[#DCE3DD] bg-white p-5 dark:border-[#1E3126] dark:bg-[#121F18]">
            <label
              htmlFor="vision-label-input"
              className="block text-xs font-medium text-[#4B6155] dark:text-[#9DB4A7]"
            >
              Capture Label
            </label>
            <input
              id="vision-label-input"
              type="text"
              value={captureLabel}
              onChange={(e) => setCaptureLabel(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-[#CFD9D1] bg-[#FAFBF9] px-3 py-2 text-sm text-[#122B1E] focus:border-[#2E7D4F] focus:outline-none dark:border-[#253B2F] dark:bg-[#0E1813] dark:text-white"
            />
            <div className="mt-4 flex flex-wrap gap-2.5">
              <button
                type="button"
                disabled={analyzing}
                onClick={() => void handleRunAnalysis()}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#153625] px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#1E4B33] disabled:opacity-60 dark:bg-[#2E7D4F] dark:hover:bg-[#256640] whitespace-nowrap"
              >
                <Sparkles className="h-4 w-4" />
                <span>{analyzing ? t('vision_analyzing') : t('vision_analyze_btn')}</span>
              </button>

              {result && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleSaveToHistory()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#2E7D4F] px-3.5 py-2.5 text-xs font-semibold text-[#153625] transition-colors hover:bg-[#EAF3EC] disabled:opacity-60 dark:border-[#59C17D] dark:text-[#A3E8BC] dark:hover:bg-[#173023] whitespace-nowrap"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>{t('vision_save_btn')}</span>
                </button>
              )}
            </div>
            {savedSuccess && (
              <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-[#1E6B40] dark:text-[#7BE0A2]">
                <CheckCircle2 className="h-4 w-4" />
                <span>{t('vision_saved_msg')}</span>
              </p>
            )}
          </div>
        </section>

        {/* Right Column: Visual Preview, Segmentation Overlay & Metrics */}
        <section className="space-y-5 lg:col-span-7">
          <div className="rounded-xl border border-[#DCE3DD] bg-white p-5 dark:border-[#1E3126] dark:bg-[#121F18]">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#122B1E] dark:text-[#EDF4EF]">
                <Layers className="h-4 w-4 text-[#2E7D4F] dark:text-[#7BE0A2]" />
                <span>{captureLabel}</span>
              </div>

              <div className="inline-flex rounded-lg border border-[#CFD9D1] bg-[#EDF1EC] p-0.5 dark:border-[#24382C] dark:bg-[#0E1813]">
                {(
                  [
                    ['original', 'vision_original_tab'],
                    ['overlay', 'vision_overlay_tab'],
                    ['split', 'vision_side_by_side'],
                  ] as const
                ).map(([mode, labelKey]) => (
                  <button
                    key={mode}
                    type="button"
                    disabled={mode !== 'original' && !result}
                    onClick={() => setViewMode(mode)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-40 whitespace-nowrap ${
                      viewMode === mode
                        ? 'bg-white text-[#122B1E] shadow-sm dark:bg-[#235439] dark:text-white'
                        : 'text-[#4B6155] dark:text-[#98B2A4]'
                    }`}
                  >
                    {t(labelKey)}
                  </button>
                ))}
              </div>
            </div>

            {/* Image / Segmentation Canvas Viewer */}
            {result && viewMode === 'split' ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <div className="mb-1 text-xs text-[#5A7064] dark:text-[#8BA396]">
                    {t('vision_original_tab')}
                  </div>
                  <img
                    src={selectedImageUrl}
                    alt="Original root chamber frame"
                    referrerPolicy="no-referrer"
                    className="aspect-[4/3] w-full rounded-lg border border-[#DCE3DD] object-cover dark:border-[#1E3126]"
                  />
                </div>
                <div>
                  <div className="mb-1 text-xs text-[#5A7064] dark:text-[#8BA396]">
                    {t('vision_overlay_tab')}
                  </div>
                  <img
                    src={result.overlayDataUrl}
                    alt="Prototype root segmentation overlay"
                    className="aspect-[4/3] w-full rounded-lg border border-[#DCE3DD] object-cover dark:border-[#1E3126]"
                  />
                </div>
              </div>
            ) : (
              <img
                src={result && viewMode === 'overlay' ? result.overlayDataUrl : selectedImageUrl}
                alt="Root visualization preview"
                referrerPolicy="no-referrer"
                className="aspect-[4/3] w-full max-h-[380px] rounded-lg border border-[#DCE3DD] object-cover dark:border-[#1E3126]"
              />
            )}

            {/* Segmentation Legend */}
            {result && (
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-[#4B6155] dark:text-[#9DB4A7]">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-xs bg-[#2EC36E]" />
                  {t('vision_legend_healthy')} ({result.healthyWhitePct}%)
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-xs bg-[#EBA523]" />
                  {t('vision_legend_tan')} ({result.tanOchrePct}%)
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-xs bg-[#DC4437]" />
                  {t('vision_legend_dark')} ({result.darkBrownPct}%)
                </span>
              </div>
            )}
          </div>

          {/* Analysis Results Metrics */}
          {result ? (
            <div className="space-y-5 rounded-xl border border-[#DCE3DD] bg-white p-6 dark:border-[#1E3126] dark:bg-[#121F18]">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <div className="text-xs text-[#5A7064] dark:text-[#8BA396]">
                    {t('vision_area_label')}
                  </div>
                  <div className="mt-1 font-mono text-xl font-bold tabular-nums text-[#122B1E] dark:text-white">
                    {result.rootAreaPct}%
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[#5A7064] dark:text-[#8BA396]">
                    {t('vision_length_label')}
                  </div>
                  <div className="mt-1 font-mono text-xl font-bold tabular-nums text-[#122B1E] dark:text-white">
                    {result.estimatedLengthCm} {t('unit_cm')}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[#5A7064] dark:text-[#8BA396]">
                    {t('vision_quality_label')}
                  </div>
                  <div className="mt-1 font-mono text-xl font-bold tabular-nums text-[#122B1E] dark:text-white">
                    {result.imageQualityScore}/100
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[#5A7064] dark:text-[#8BA396]">
                    {t('vision_confidence_label')}
                  </div>
                  <div className="mt-1 font-mono text-xl font-bold tabular-nums text-[#122B1E] dark:text-white">
                    {result.confidencePct}%
                  </div>
                </div>
              </div>

              {/* Color Proportion Stacked Bar */}
              <div className="border-t border-[#ECF0EC] pt-4 dark:border-[#1B2D22]">
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#122B1E] dark:text-[#EDF4EF]">
                    {t('vision_color_title')}
                  </span>
                  <span className="font-semibold text-[#8B5A2B] dark:text-[#E2B478]">
                    {t('vision_stress_label')}: {t(`risk_${result.stressIndicatorLevel}`)}
                  </span>
                </div>
                <div className="flex h-3 w-full overflow-hidden rounded-full bg-[#E8EDE9] dark:bg-[#1B2C22]">
                  <div style={{ width: `${result.healthyWhitePct}%` }} className="bg-[#2E9E5B]" />
                  <div style={{ width: `${result.tanOchrePct}%` }} className="bg-[#D9911E]" />
                  <div style={{ width: `${result.darkBrownPct}%` }} className="bg-[#C94436]" />
                </div>
                <p className="mt-3 text-sm leading-relaxed text-[#3C5246] dark:text-[#B4C8BC]">
                  {t(result.summaryKey)}
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-[#DCE3DD] bg-white p-6 text-sm text-[#5A7064] dark:border-[#1E3126] dark:bg-[#121F18] dark:text-[#8BA396]">
              Click <strong className="text-[#122B1E] dark:text-white">{t('vision_analyze_btn')}</strong> to run the client-side prototype segmentation and inspect root area, color breakdown, and stress indicators.
            </div>
          )}

          {/* Honest Limitations & Python FastAPI Architecture Note */}
          <div className="rounded-xl border border-[#DCE3DD] bg-[#F3F4EF] p-5 dark:border-[#1E3126] dark:bg-[#101C16]">
            <h3 className="font-display text-sm font-semibold text-[#122B1E] dark:text-[#EDF4EF]">
              {t('vision_limitations_title')}
            </h3>
            <p className="mt-1.5 text-xs leading-relaxed text-[#4B6155] dark:text-[#9DB4A7]">
              {t('vision_limitations_body')}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
