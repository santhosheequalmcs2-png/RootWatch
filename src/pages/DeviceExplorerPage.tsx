import { useState } from 'react';
import { DeviceExplorerScene } from '../components/three/DeviceExplorerScene';
import { DEVICE_PARTS } from '../data/samples';
import { useApp } from '../i18n/LanguageContext';

export function DeviceExplorerPage() {
  const { t } = useApp();
  const [selectedPartId, setSelectedPartId] = useState<string>('chamber');

  const selectedSpec =
    DEVICE_PARTS.find((p) => p.id === selectedPartId) ?? DEVICE_PARTS[0];

  return (
    <div className="space-y-6">
      <div className="border-b border-[#DCE3DD] pb-5 dark:border-[#1E3126]">
        <h1 className="font-display text-2xl font-bold tracking-tight text-[#122B1E] sm:text-3xl dark:text-[#F0F6F2]">
          {t('three_device_title')}
        </h1>
        <p className="mt-1 text-sm text-[#4B6155] dark:text-[#9DB4A7]">
          {t('three_device_subtitle')}
        </p>
      </div>

      {/* Interactive 3D Viewport + Structured Below/Beside Component Inspector */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <DeviceExplorerScene
            selectedPartId={selectedPartId}
            onSelectPart={setSelectedPartId}
          />
          <p className="mt-2.5 text-xs text-[#5A7064] dark:text-[#8BA396]">
            {t('three_select_hint')}
          </p>
        </div>

        {/* Component Information Panel & 13-Part Selector */}
        <aside className="flex flex-col gap-5 xl:col-span-4">
          <div className="rounded-xl border border-[#DCE3DD] bg-white p-5 dark:border-[#1E3126] dark:bg-[#121F18]">
            <div className="text-xs font-medium text-[#2E7D4F] dark:text-[#7BE0A2]">
              {t(selectedSpec.roleKey)}
            </div>
            <h2 className="mt-1 font-display text-xl font-bold text-[#122B1E] dark:text-white">
              {t(selectedSpec.nameKey)}
            </h2>
            <p className="mt-2.5 text-sm leading-relaxed text-[#3C5246] dark:text-[#B4C8BC]">
              {t(selectedSpec.descKey)}
            </p>

            <div className="mt-4 space-y-2.5 border-t border-[#ECF0EC] pt-4 text-xs dark:border-[#1B2D22]">
              <div>
                <div className="text-[#5A7064] dark:text-[#8BA396]">{t('three_specs_label')}</div>
                <div className="mt-0.5 font-mono text-[#122B1E] dark:text-[#E6F1EA]">
                  {selectedSpec.specs}
                </div>
              </div>
              <div>
                <div className="text-[#5A7064] dark:text-[#8BA396]">{t('three_status_label')}</div>
                <div className="mt-0.5 font-semibold text-[#8B5A2B] dark:text-[#E2B478]">
                  {t(selectedSpec.statusKey)}
                </div>
              </div>
            </div>
          </div>

          {/* All 13 Hardware Components List */}
          <div className="rounded-xl border border-[#DCE3DD] bg-white p-4 dark:border-[#1E3126] dark:bg-[#121F18]">
            <div className="mb-2.5 px-1 text-xs font-semibold text-[#4B6155] dark:text-[#9DB4A7]">
              13 Prototype Subsystems
            </div>
            <div className="grid max-h-[320px] grid-cols-1 gap-1 overflow-y-auto pr-1">
              {DEVICE_PARTS.map((part, idx) => {
                const active = part.id === selectedPartId;
                return (
                  <button
                    key={part.id}
                    type="button"
                    onClick={() => setSelectedPartId(part.id)}
                    aria-pressed={active}
                    className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors ${
                      active
                        ? 'bg-[#153625] text-white dark:bg-[#24593C]'
                        : 'text-[#2A4034] hover:bg-[#EDF2EE] dark:text-[#C5DACD] dark:hover:bg-[#192B21]'
                    }`}
                  >
                    <span className="truncate">
                      <span className="mr-2 font-mono opacity-65">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      {t(part.nameKey)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
