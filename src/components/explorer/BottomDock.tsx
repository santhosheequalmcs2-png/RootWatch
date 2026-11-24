import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Pause,
  Play,
  Square,
} from 'lucide-react';
import {
  COMPONENT_ORDER,
  COMPONENT_SPECS,
  DEMO_STEPS,
  type ComponentId,
  type DemoStep,
} from '../../data/componentsData';

interface BottomDockProps {
  selectedId: ComponentId | null;
  highlightedIds: ComponentId[];
  collapsed: boolean;
  demoActive: boolean;
  demoPaused: boolean;
  demoStepIndex: number;
  onToggleCollapsed: () => void;
  onSelectComponent: (id: ComponentId) => void;
  onDemoTogglePause: () => void;
  onDemoPrevStep: () => void;
  onDemoNextStep: () => void;
  onDemoStop: () => void;
  onHoverSound: () => void;
}

export function BottomDock({
  selectedId,
  highlightedIds,
  collapsed,
  demoActive,
  demoPaused,
  demoStepIndex,
  onToggleCollapsed,
  onSelectComponent,
  onDemoTogglePause,
  onDemoPrevStep,
  onDemoNextStep,
  onDemoStop,
  onHoverSound,
}: BottomDockProps) {
  const activeDemoStep: DemoStep | null = demoActive ? DEMO_STEPS[demoStepIndex] ?? null : null;
  const highlightedSet = new Set<ComponentId>(highlightedIds);

  return (
    <div className="pointer-events-none absolute right-0 bottom-3 left-0 z-20 flex flex-col items-center px-3 sm:px-5">
      {/* Compact Collapse / Expand Tab */}
      <button
        type="button"
        onClick={onToggleCollapsed}
        onMouseEnter={onHoverSound}
        className="pointer-events-auto mb-1.5 inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md border border-[#8cc59e]/20 bg-[#0d1712]/94 px-3 text-[11px] font-medium text-[#b5c9bc] shadow transition-colors hover:border-[#52b788]/50 hover:text-[#f3f1ea]"
      >
        {collapsed ? (
          <>
            <ChevronUp className="h-3.5 w-3.5 text-[#7cc99c]" />
            <span>Show Components</span>
          </>
        ) : (
          <>
            <ChevronDown className="h-3.5 w-3.5 text-[#7cc99c]" />
            <span>Hide Controls</span>
          </>
        )}
      </button>

      {!collapsed && (
        <div className="pointer-events-auto w-full max-w-[1060px] overflow-hidden rounded-xl border border-[#8cc59e]/18 bg-[#0b1410]/94 shadow-2xl">
          {/* Active Guided Demo Bar (Steps 1–10) */}
          {activeDemoStep && (
            <div className="border-b border-[#8cc59e]/15 bg-[#102018]/95 px-4 py-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs text-[#8fb39c]">
                    <span className="font-mono font-semibold text-[#6ee7a8] tabular-nums">
                      Step {String(activeDemoStep.stepNumber).padStart(2, '0')} /{' '}
                      {String(DEMO_STEPS.length).padStart(2, '0')}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-display font-semibold text-[#f3f1ea]">
                      {activeDemoStep.title}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-[#cfdcd3] sm:text-sm">
                    {activeDemoStep.description}
                  </p>
                </div>

                {/* Playback controls */}
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={onDemoPrevStep}
                    onMouseEnter={onHoverSound}
                    disabled={demoStepIndex === 0}
                    className="inline-flex h-8 cursor-pointer items-center justify-center rounded-md border border-[#8cc59e]/20 bg-[#14251d] px-2 text-xs text-[#dce8df] transition-colors hover:border-[#52b788]/50 disabled:cursor-not-allowed disabled:opacity-40"
                    title="Previous step"
                    aria-label="Previous step"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    onClick={onDemoTogglePause}
                    onMouseEnter={onHoverSound}
                    className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-[#52b788]/45 bg-[#1a3a2b] px-3 text-xs font-medium text-[#f3f1ea] whitespace-nowrap transition-colors hover:bg-[#224b37]"
                  >
                    {demoPaused ? (
                      <>
                        <Play className="h-3.5 w-3.5 fill-current" />
                        <span>Resume</span>
                      </>
                    ) : (
                      <>
                        <Pause className="h-3.5 w-3.5" />
                        <span>Pause</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={onDemoNextStep}
                    onMouseEnter={onHoverSound}
                    className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-md border border-[#8cc59e]/22 bg-[#14251d] px-3 text-xs font-medium text-[#e4ede7] whitespace-nowrap transition-colors hover:border-[#52b788]/55"
                  >
                    <span>
                      {demoStepIndex === DEMO_STEPS.length - 1 ? 'Restart' : 'Next Step'}
                    </span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={onDemoStop}
                    onMouseEnter={onHoverSound}
                    className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-[#d99230]/40 bg-[#2a1f10] px-2.5 text-xs font-medium text-[#f5d5a2] whitespace-nowrap transition-colors hover:bg-[#3a2a15]"
                    title="Stop demonstration"
                  >
                    <Square className="h-3 w-3 fill-current" />
                    <span className="hidden sm:inline">Stop</span>
                  </button>
                </div>
              </div>

              {/* Clean 10-segment step progress bar */}
              <div className="mt-2.5 grid grid-cols-10 gap-1" aria-hidden="true">
                {DEMO_STEPS.map((step, idx) => (
                  <div
                    key={step.stepNumber}
                    className={`h-1 rounded-full transition-colors ${
                      idx < demoStepIndex
                        ? 'bg-[#52b788]'
                        : idx === demoStepIndex
                          ? 'bg-[#86efac]'
                          : 'bg-[#22362b]'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Component Selector Strip (All 12 Selectable Hardware Components) */}
          <div className="rw-scroll flex items-center gap-1.5 overflow-x-auto px-3 py-2.5">
            {COMPONENT_ORDER.map((id) => {
              const spec = COMPONENT_SPECS[id];
              const isSelected = selectedId === id;
              const isHighlighted = highlightedSet.has(id);

              let btnStyle =
                'border-[#8cc59e]/16 bg-[#111d17] text-[#bdd0c3] hover:border-[#52b788]/45 hover:text-[#f3f1ea]';

              if (spec.experimental) {
                btnStyle =
                  isSelected || isHighlighted
                    ? 'border-[#e5a446] bg-[#312310] text-[#fce7c3]'
                    : 'border-[#8a652d]/45 bg-[#191610] text-[#e0c79c] hover:border-[#e5a446] hover:text-[#fce7c3]';
              } else if (isSelected) {
                btnStyle = 'border-[#52b788] bg-[#1c3d2d] text-[#f3f1ea]';
              } else if (isHighlighted) {
                btnStyle = 'border-[#52b788]/65 bg-[#152e22] text-[#e8f5ec]';
              }

              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onSelectComponent(id)}
                  onMouseEnter={onHoverSound}
                  className={`inline-flex h-8 shrink-0 cursor-pointer items-center rounded-md border px-2.5 text-xs font-medium whitespace-nowrap transition-colors ${btnStyle}`}
                >
                  {spec.shortLabel}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
