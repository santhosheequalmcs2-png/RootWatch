import { ChevronRight, PanelRightOpen, RotateCcw } from 'lucide-react';
import { COMPONENT_SPECS, type ComponentId } from '../../data/componentsData';
import { hasSensorHistory } from '../../data/sensorHistoryData';
import { SensorHistoryChart } from './SensorHistoryChart';

interface InspectorPanelProps {
  selectedId: ComponentId | null;
  open: boolean;
  onToggleOpen: () => void;
  onResetSelection: () => void;
  onHoverSound: () => void;
  onToggleSound: (active: boolean) => void;
  onScrubSound: () => void;
}

export function InspectorPanel({
  selectedId,
  open,
  onToggleOpen,
  onResetSelection,
  onHoverSound,
  onToggleSound,
  onScrubSound,
}: InspectorPanelProps) {
  const spec = selectedId ? COMPONENT_SPECS[selectedId] : null;

  if (!open) {
    return (
      <div className="pointer-events-auto absolute top-18 right-4 z-20">
        <button
          type="button"
          onClick={onToggleOpen}
          onMouseEnter={onHoverSound}
          className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-[#8cc59e]/20 bg-[#0d1712]/94 px-3 text-xs font-medium text-[#dce8df] shadow-lg transition-colors hover:border-[#52b788]/55 hover:text-[#f3f1ea]"
          title="Open component inspector panel"
        >
          <PanelRightOpen className="h-3.5 w-3.5 text-[#7cc99c]" />
          <span>{spec ? spec.shortLabel : 'Inspector'}</span>
        </button>
      </div>
    );
  }

  return (
    <aside
      aria-label="Component Inspector"
      className="pointer-events-auto absolute top-18 right-4 z-20 flex max-h-[calc(100vh-12.5rem)] w-[min(328px,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-[#8cc59e]/18 bg-[#0c1510]/94 shadow-2xl"
    >
      {/* Header row */}
      <div className="flex items-center justify-between gap-2 border-b border-[#8cc59e]/14 px-4 py-3">
        <span className="font-display text-xs font-semibold tracking-wide text-[#8fb39c]">
          Component Inspector
        </span>
        <button
          type="button"
          onClick={onToggleOpen}
          onMouseEnter={onHoverSound}
          className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-[#8fb39c] transition-colors hover:bg-[#182920] hover:text-[#f3f1ea]"
          title="Collapse inspector panel"
          aria-label="Collapse inspector panel"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="rw-scroll flex-1 overflow-y-auto px-4 py-4">
        {spec ? (
          <div className="space-y-4">
            <div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#89ab96]">
                <span className={spec.experimental ? 'font-medium text-[#e5a446]' : 'font-medium text-[#6ee7a8]'}>
                  {spec.category}
                </span>
                <span aria-hidden="true">·</span>
                <span>Selected Component</span>
              </div>
              <h2 className="mt-1 font-display text-lg font-bold tracking-tight text-[#f3f1ea]">
                {spec.name}
              </h2>
            </div>

            {spec.experimental && (
              <div className="rounded-lg border border-[#d99230]/40 bg-[#261d10] p-3 text-xs leading-relaxed text-[#f1d5a8]">
                <p className="font-semibold text-[#f5bd68]">Experimental Subsystem</p>
                <p className="mt-1">
                  Intended to investigate electrical properties in the root zone. Not validated as
                  a direct measure of root mass without calibration.
                </p>
              </div>
            )}

            {hasSensorHistory(spec.id) && (
              <SensorHistoryChart
                componentId={spec.id}
                onToggleSound={onToggleSound}
                onScrubSound={onScrubSound}
              />
            )}

            <div className="space-y-3 border-t border-[#8cc59e]/12 pt-3">
              <div>
                <h3 className="text-xs font-semibold text-[#89ab96]">Device Location</h3>
                <p className="mt-1 text-sm leading-relaxed text-[#e6ede8]">{spec.location}</p>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-[#89ab96]">Description</h3>
                <p className="mt-1 text-sm leading-relaxed text-[#d4dfd7]">{spec.summary}</p>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-[#89ab96]">Primary Purpose</h3>
                <p className="mt-1 text-sm leading-relaxed text-[#d4dfd7]">{spec.purpose}</p>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-[#89ab96]">Function in RootWatch</h3>
                <p className="mt-1 text-sm leading-relaxed text-[#d4dfd7]">{spec.contribution}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <h2 className="font-display text-base font-bold text-[#f3f1ea]">
              RootWatch Architecture
            </h2>
            <p className="text-sm leading-relaxed text-[#b9cabe]">
              Click any component directly on the 3D prototype or select a module below to inspect
              its sensing role, physical placement, and contribution to root-zone monitoring.
            </p>
            <div className="space-y-2 border-t border-[#8cc59e]/12 pt-3 text-xs text-[#8ea899]">
              <p>Drag to orbit 360° around the prototype.</p>
              <p>Scroll or pinch to zoom into roots and probes.</p>
              <p>Right-drag to pan across assemblies.</p>
              <p>Use Exploded View to separate internal layers.</p>
            </div>
          </div>
        )}
      </div>

      {/* Footer reset action when a component is selected */}
      {spec && (
        <div className="border-t border-[#8cc59e]/14 px-4 py-3">
          <button
            type="button"
            onClick={onResetSelection}
            onMouseEnter={onHoverSound}
            className="inline-flex h-9 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#8cc59e]/22 bg-[#13211a] px-3 text-xs font-medium text-[#e4ede7] transition-colors hover:border-[#52b788]/55 hover:bg-[#192c22]"
          >
            <RotateCcw className="h-3.5 w-3.5 text-[#7cc99c]" />
            <span>Reset Selection</span>
          </button>
        </div>
      )}
    </aside>
  );
}
