import { Layers, Minimize2, Play, RotateCcw, Square, Tag, Volume2, VolumeX } from 'lucide-react';

interface TopBarProps {
  exploded: boolean;
  showLabels: boolean;
  demoActive: boolean;
  muted: boolean;
  onResetView: () => void;
  onSetExploded: (exploded: boolean) => void;
  onToggleLabels: () => void;
  onToggleDemo: () => void;
  onToggleMute: () => void;
  onHoverSound: () => void;
}

export function TopBar({
  exploded,
  showLabels,
  demoActive,
  muted,
  onResetView,
  onSetExploded,
  onToggleLabels,
  onToggleDemo,
  onToggleMute,
  onHoverSound,
}: TopBarProps) {
  return (
    <header className="pointer-events-auto absolute top-0 right-0 left-0 z-20 flex h-14 items-center justify-between gap-4 border-b border-[#8cc59e]/15 bg-[#0b130f]/94 px-4 sm:px-6">
      {/* Zone 1: Brand wordmark + Interactive Device Explorer */}
      <div className="flex min-w-0 items-center gap-3">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#52b788]/35 bg-[#13261c]"
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 text-[#6ee7a8]" fill="none">
            <path
              d="M12 3v7m0 0c-3.5 0-6 2.2-6 5.5M12 10c3.5 0 6 2.2 6 5.5M12 10v11m0-7c-2 1.2-3.2 2.8-3.5 5m3.5-3.2c1.8 1 3 2.5 3.3 4.5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <div className="flex min-w-0 items-baseline gap-2.5 truncate">
          <h1 className="font-display text-base font-bold tracking-tight text-[#f3f1ea] whitespace-nowrap shrink-0">
            RootWatch
          </h1>
          <span className="hidden text-xs text-[#6f8a7a] sm:inline" aria-hidden="true">
            ·
          </span>
          <span className="hidden truncate text-xs font-medium text-[#9eb5a6] sm:inline">
            Interactive Device Explorer
          </span>
        </div>
      </div>

      {/* Zone 2: Engineering viewport controls */}
      <div className="flex items-center gap-2 overflow-x-auto rw-scroll">
        <button
          type="button"
          onClick={onResetView}
          onMouseEnter={onHoverSound}
          className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-[#8cc59e]/18 bg-[#121e18] px-3 text-xs font-medium text-[#dce8df] whitespace-nowrap transition-colors hover:border-[#52b788]/50 hover:text-[#f3f1ea]"
          title="Reset camera angle and zoom (R)"
        >
          <RotateCcw className="h-3.5 w-3.5 text-[#7cc99c]" />
          <span className="hidden md:inline">Reset View</span>
        </button>

        {/* Assemble / Exploded View Segmented Control */}
        <div
          className="flex h-9 shrink-0 items-center rounded-lg border border-[#8cc59e]/18 bg-[#0f1914] p-0.5"
          role="group"
          aria-label="Assembly view mode"
        >
          <button
            type="button"
            onClick={() => onSetExploded(false)}
            onMouseEnter={onHoverSound}
            className={`inline-flex h-full shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-xs font-medium whitespace-nowrap transition-colors ${
              !exploded
                ? 'bg-[#214533] text-[#f3f1ea]'
                : 'text-[#96aea0] hover:text-[#f3f1ea]'
            }`}
          >
            <Minimize2 className="h-3.5 w-3.5" />
            <span>Assemble</span>
          </button>
          <button
            type="button"
            onClick={() => onSetExploded(true)}
            onMouseEnter={onHoverSound}
            className={`inline-flex h-full shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-xs font-medium whitespace-nowrap transition-colors ${
              exploded
                ? 'bg-[#214533] text-[#f3f1ea]'
                : 'text-[#96aea0] hover:text-[#f3f1ea]'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Exploded View</span>
          </button>
        </div>

        <button
          type="button"
          onClick={onToggleLabels}
          onMouseEnter={onHoverSound}
          aria-pressed={showLabels}
          className={`inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border px-3 text-xs font-medium whitespace-nowrap transition-colors ${
            showLabels
              ? 'border-[#52b788]/65 bg-[#173526] text-[#f3f1ea]'
              : 'border-[#8cc59e]/18 bg-[#121e18] text-[#b4c8bb] hover:border-[#52b788]/45 hover:text-[#f3f1ea]'
          }`}
          title="Show or hide 3D component labels (L)"
        >
          <Tag className="h-3.5 w-3.5 text-[#7cc99c]" />
          <span className="hidden sm:inline">{showLabels ? 'Labels On' : 'Labels'}</span>
        </button>

        <button
          type="button"
          onClick={onToggleMute}
          onMouseEnter={onHoverSound}
          aria-pressed={!muted}
          aria-label={muted ? 'Unmute UI sound effects' : 'Mute UI sound effects'}
          title={muted ? 'Enable UI sound effects (M)' : 'Mute UI sound effects (M)'}
          className={`inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border transition-colors ${
            muted
              ? 'border-[#8cc59e]/16 bg-[#101914] text-[#6f8779] hover:border-[#52b788]/40 hover:text-[#c7d8cd]'
              : 'border-[#8cc59e]/20 bg-[#121e18] text-[#7cc99c] hover:border-[#52b788]/50 hover:text-[#f3f1ea]'
          }`}
        >
          {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
        </button>

        {/* Zone 3: Primary action — Start / Stop Demo */}
        <button
          type="button"
          onClick={onToggleDemo}
          onMouseEnter={onHoverSound}
          className={`inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-3.5 text-xs font-semibold whitespace-nowrap transition-colors ${
            demoActive
              ? 'border border-[#d99230]/60 bg-[#3a2811] text-[#fce7c3] hover:bg-[#4a3316]'
              : 'bg-[#2d6a4f] text-[#f3f1ea] hover:bg-[#38805f]'
          }`}
        >
          {demoActive ? (
            <>
              <Square className="h-3 w-3 fill-current" />
              <span>Stop Demo</span>
            </>
          ) : (
            <>
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>Start Demo</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
}
