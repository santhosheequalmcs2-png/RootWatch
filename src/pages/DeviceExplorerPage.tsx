import {
  Layers,
  Maximize2,
  Minimize2,
  Play,
  RotateCcw,
  Tag,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BottomDock } from '../components/explorer/BottomDock';
import { InspectorPanel } from '../components/explorer/InspectorPanel';
import { LabelOverlay } from '../components/explorer/LabelOverlay';
import {
  COMPONENT_SPECS,
  DEFAULT_CAMERA_POSE,
  DEMO_STEPS,
  EXPLODED_CAMERA_POSE,
  type CameraPose,
  type ComponentId,
} from '../data/componentsData';
import { useUiSound } from '../hooks/useUiSound';
import { useApp } from '../i18n/LanguageContext';
import { RootWatchViewport, type ProjectedLabel } from '../scene/RootWatchViewport';

export function DeviceExplorerPage() {
  const { t } = useApp();
  const [selectedId, setSelectedId] = useState<ComponentId | null>(null);
  const [exploded, setExploded] = useState<boolean>(false);
  const [showLabels, setShowLabels] = useState<boolean>(true);
  const [inspectorOpen, setInspectorOpen] = useState<boolean>(true);
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Guided 10-Step Demonstration Mode state
  const [demoActive, setDemoActive] = useState<boolean>(false);
  const [demoPaused, setDemoPaused] = useState<boolean>(false);
  const [demoStepIndex, setDemoStepIndex] = useState<number>(0);

  // Live 3D-to-2D projected component labels
  const [projectedLabels, setProjectedLabels] = useState<ProjectedLabel[]>([]);

  // Subtle Web Audio UI tactile sound controller
  const sound = useUiSound();
  const prevDemoStepRef = useRef<number | null>(null);

  // Monotonic camera transition requests
  const camSeqRef = useRef(0);
  const [cameraRequest, setCameraRequest] = useState<{ pose: CameraPose; seq: number } | null>(
    null,
  );

  const moveCameraTo = useCallback((pose: CameraPose) => {
    camSeqRef.current += 1;
    setCameraRequest({ pose, seq: camSeqRef.current });
  }, []);

  const activeDemoStep = demoActive ? DEMO_STEPS[demoStepIndex] ?? null : null;

  // Derived 3D visual parameters driven by manual exploration or active Demo step
  const highlightedIds = useMemo<ComponentId[]>(() => {
    if (activeDemoStep) {
      return activeDemoStep.highlightedComponents;
    }
    return selectedId ? [selectedId] : [];
  }, [activeDemoStep, selectedId]);

  const effectiveExploded = activeDemoStep ? activeDemoStep.exploded : exploded;
  const effectiveLidOpen = activeDemoStep
    ? activeDemoStep.lidOpenFactor
    : selectedId === 'esp32' || exploded
      ? 1
      : 0;
  const effectiveLedBoost = activeDemoStep
    ? activeDemoStep.ledBoost
    : selectedId === 'leds' || selectedId === 'camera'
      ? 1.0
      : 0.35;

  const { playDemoTransition, playExplode } = sound;

  // Apply camera pose and harmonic transition cue whenever Demo step changes
  useEffect(() => {
    if (!demoActive) {
      prevDemoStepRef.current = null;
      return;
    }
    const step = DEMO_STEPS[demoStepIndex];
    if (!step) return;

    if (prevDemoStepRef.current !== null && prevDemoStepRef.current !== demoStepIndex) {
      playDemoTransition(step.stepNumber);
      if (step.exploded && !DEMO_STEPS[prevDemoStepRef.current]?.exploded) {
        playExplode(true);
      }
    }
    prevDemoStepRef.current = demoStepIndex;

    moveCameraTo(step.cameraPose);
    setSelectedId(step.primaryComponent);
    if (step.primaryComponent) {
      setInspectorOpen(true);
    }
  }, [demoActive, demoStepIndex, moveCameraTo, playDemoTransition, playExplode]);

  // Auto-advance timer during unpaused Demo Mode
  useEffect(() => {
    if (!demoActive || demoPaused) return;
    const step = DEMO_STEPS[demoStepIndex];
    if (!step) return;

    const timer = window.setTimeout(() => {
      if (demoStepIndex < DEMO_STEPS.length - 1) {
        setDemoStepIndex((prev) => prev + 1);
      } else {
        setDemoPaused(true);
      }
    }, step.durationMs);

    return () => window.clearTimeout(timer);
  }, [demoActive, demoPaused, demoStepIndex]);

  // Handlers
  const handleSelectComponent = useCallback(
    (id: ComponentId | null) => {
      if (demoActive) {
        setDemoActive(false);
        setDemoPaused(false);
      }
      setSelectedId(id);
      if (id) {
        const spec = COMPONENT_SPECS[id];
        sound.playSelect(Boolean(spec?.experimental));
        setInspectorOpen(true);
        if (spec) {
          moveCameraTo(spec.focusPose);
        }
      }
    },
    [demoActive, moveCameraTo, sound],
  );

  const handleHover3dComponent = useCallback(
    (id: ComponentId | null) => {
      if (id) {
        sound.playHover();
      }
    },
    [sound],
  );

  const handleResetSelection = useCallback(() => {
    sound.playReset();
    setSelectedId(null);
    moveCameraTo(exploded ? EXPLODED_CAMERA_POSE : DEFAULT_CAMERA_POSE);
  }, [exploded, moveCameraTo, sound]);

  const handleResetView = useCallback(() => {
    sound.playReset();
    if (demoActive) {
      setDemoActive(false);
      setDemoPaused(false);
    }
    setSelectedId(null);
    setExploded(false);
    moveCameraTo(DEFAULT_CAMERA_POSE);
  }, [demoActive, moveCameraTo, sound]);

  const handleSetExploded = useCallback(
    (nextExploded: boolean) => {
      if (demoActive) {
        setDemoActive(false);
        setDemoPaused(false);
      }
      if (nextExploded !== effectiveExploded) {
        sound.playExplode(nextExploded);
      }
      setExploded(nextExploded);
      moveCameraTo(nextExploded ? EXPLODED_CAMERA_POSE : DEFAULT_CAMERA_POSE);
    },
    [demoActive, effectiveExploded, moveCameraTo, sound],
  );

  const handleToggleLabels = useCallback(() => {
    setShowLabels((prev) => {
      const next = !prev;
      sound.playToggle(next);
      return next;
    });
  }, [sound]);

  const handleToggleInspector = useCallback(() => {
    setInspectorOpen((prev) => {
      const next = !prev;
      sound.playToggle(next);
      return next;
    });
  }, [sound]);

  const handleToggleDock = useCallback(() => {
    setDockCollapsed((prev) => {
      const next = !prev;
      sound.playToggle(!next);
      return next;
    });
  }, [sound]);

  const handleToggleDemo = useCallback(() => {
    if (demoActive) {
      sound.playDemoStop();
      setDemoActive(false);
      setDemoPaused(false);
      setExploded(false);
      setSelectedId(null);
      moveCameraTo(DEFAULT_CAMERA_POSE);
    } else {
      sound.playDemoStart();
      setDockCollapsed(false);
      setDemoStepIndex(0);
      setDemoPaused(false);
      setDemoActive(true);
    }
  }, [demoActive, moveCameraTo, sound]);

  const handleDemoTogglePause = useCallback(() => {
    setDemoPaused((prev) => {
      const next = !prev;
      sound.playToggle(!next);
      return next;
    });
  }, [sound]);

  const handleDemoPrevStep = useCallback(() => {
    setDemoStepIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const handleDemoNextStep = useCallback(() => {
    setDemoStepIndex((prev) => {
      if (prev >= DEMO_STEPS.length - 1) {
        setDemoPaused(false);
        return 0;
      }
      return prev + 1;
    });
  }, []);

  const handleDemoStop = useCallback(() => {
    sound.playDemoStop();
    setDemoActive(false);
    setDemoPaused(false);
    setExploded(false);
    setSelectedId(null);
    moveCameraTo(DEFAULT_CAMERA_POSE);
  }, [moveCameraTo, sound]);

  // Keyboard navigation shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'Escape') {
        if (isFullscreen) setIsFullscreen(false);
        else if (demoActive) handleDemoStop();
        else if (selectedId) handleResetSelection();
      } else if (e.key === 'r' || e.key === 'R') {
        handleResetView();
      } else if (e.key === 'e' || e.key === 'E') {
        handleSetExploded(!effectiveExploded);
      } else if (e.key === 'l' || e.key === 'L') {
        handleToggleLabels();
      } else if (e.key === 'm' || e.key === 'M') {
        sound.toggleMute();
      } else if (e.key === ' ' && demoActive) {
        e.preventDefault();
        handleDemoTogglePause();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    demoActive,
    selectedId,
    effectiveExploded,
    isFullscreen,
    handleDemoStop,
    handleResetSelection,
    handleResetView,
    handleSetExploded,
    handleToggleLabels,
    handleDemoTogglePause,
    sound,
  ]);

  return (
    <div className="space-y-4">
      {/* Page Header */}
      {!isFullscreen && (
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#DCE3DD] pb-4 dark:border-[#1E3126]">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-[#122B1E] sm:text-3xl dark:text-[#F0F6F2]">
              {t('three_device_title')}
            </h1>
            <p className="mt-1 text-sm text-[#4B6155] dark:text-[#9DB4A7]">
              Interactive 3D engineering visualization of the RootWatch agricultural monitoring prototype.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsFullscreen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#DCE3DD] bg-white px-3 py-1.5 text-xs font-semibold text-[#122B1E] shadow-sm transition-colors hover:bg-[#F2F5F0] dark:border-[#1E3126] dark:bg-[#121F18] dark:text-[#EDF4EF] dark:hover:bg-[#1A2D22]"
            >
              <Maximize2 className="h-3.5 w-3.5 text-[#2E7D4F] dark:text-[#7BE0A2]" />
              <span>Fullscreen Mode</span>
            </button>
          </div>
        </div>
      )}

      {/* Main 3D Interactive Container */}
      <div
        className={`relative overflow-hidden rounded-2xl border border-[#8cc59e]/20 bg-[#090f0c] shadow-2xl transition-all ${
          isFullscreen
            ? 'fixed inset-0 z-50 rounded-none border-0'
            : 'h-[780px] w-full'
        }`}
      >
        {/* Top Floating Viewport Control Bar */}
        <div className="pointer-events-auto absolute top-0 right-0 left-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-[#8cc59e]/15 bg-[#0b130f]/90 px-4 backdrop-blur-md">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#6ee7a8]">
            <span className="h-2 w-2 rounded-full bg-[#52b788] animate-pulse" />
            <span className="hidden sm:inline">RootWatch 3D Engineering Rig</span>
            <span className="text-[#88a393] font-normal">· 13 Subsystems</span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto rw-scroll">
            <button
              type="button"
              onClick={handleResetView}
              onMouseEnter={sound.playHover}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#8cc59e]/20 bg-[#121e18] px-2.5 text-xs font-medium text-[#dce8df] transition-colors hover:border-[#52b788]/50 hover:text-white"
              title="Reset View (R)"
            >
              <RotateCcw className="h-3 w-3 text-[#7cc99c]" />
              <span className="hidden md:inline">Reset</span>
            </button>

            {/* Assemble / Exploded View */}
            <div className="flex h-8 items-center rounded-lg border border-[#8cc59e]/20 bg-[#0f1914] p-0.5">
              <button
                type="button"
                onClick={() => handleSetExploded(false)}
                onMouseEnter={sound.playHover}
                className={`inline-flex h-full items-center gap-1 rounded-md px-2 text-xs font-medium transition-colors ${
                  !effectiveExploded ? 'bg-[#214533] text-white' : 'text-[#96aea0] hover:text-white'
                }`}
              >
                <Minimize2 className="h-3 w-3" />
                <span>Assemble</span>
              </button>
              <button
                type="button"
                onClick={() => handleSetExploded(true)}
                onMouseEnter={sound.playHover}
                className={`inline-flex h-full items-center gap-1 rounded-md px-2 text-xs font-medium transition-colors ${
                  effectiveExploded ? 'bg-[#214533] text-white' : 'text-[#96aea0] hover:text-white'
                }`}
              >
                <Layers className="h-3 w-3" />
                <span>Exploded (E)</span>
              </button>
            </div>

            {/* Labels Toggle */}
            <button
              type="button"
              onClick={handleToggleLabels}
              onMouseEnter={sound.playHover}
              className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors ${
                showLabels
                  ? 'border-[#52b788]/40 bg-[#1b3829] text-[#7ce7ab]'
                  : 'border-[#8cc59e]/20 bg-[#121e18] text-[#96aea0] hover:text-white'
              }`}
              title="Toggle Labels (L)"
            >
              <Tag className="h-3 w-3" />
              <span className="hidden sm:inline">Labels</span>
            </button>

            {/* Guided Demo Button */}
            <button
              type="button"
              onClick={handleToggleDemo}
              onMouseEnter={sound.playHover}
              className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors ${
                demoActive
                  ? 'border-[#f59e0b]/50 bg-[#3d2708] text-[#fbbf24]'
                  : 'border-[#52b788]/40 bg-[#132d20] text-[#7ce7ab] hover:bg-[#1d4330]'
              }`}
            >
              <Play className="h-3 w-3 fill-current" />
              <span>{demoActive ? 'Stop Demo' : 'Guided Demo'}</span>
            </button>

            {/* Audio Mute Toggle */}
            <button
              type="button"
              onClick={sound.toggleMute}
              onMouseEnter={sound.playHover}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#8cc59e]/20 bg-[#121e18] text-[#96aea0] hover:text-white"
              title={sound.muted ? 'Unmute UI Audio (M)' : 'Mute UI Audio (M)'}
            >
              {sound.muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5 text-[#6ee7a8]" />}
            </button>

            {/* Fullscreen Close button when in fullscreen */}
            {isFullscreen && (
              <button
                type="button"
                onClick={() => setIsFullscreen(false)}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-red-500/40 bg-red-950/40 px-2.5 text-xs font-medium text-red-200 hover:bg-red-900/50"
              >
                <span>Exit Fullscreen</span>
              </button>
            )}
          </div>
        </div>

        {/* 3D WebGL Viewport */}
        <RootWatchViewport
          selectedId={selectedId}
          highlightedIds={highlightedIds}
          exploded={effectiveExploded}
          lidOpenFactor={effectiveLidOpen}
          ledBoost={effectiveLedBoost}
          showLabels={showLabels}
          cameraRequest={cameraRequest}
          inspectorOpen={inspectorOpen}
          onSelectComponent={handleSelectComponent}
          onHoverComponent={handleHover3dComponent}
          onLabelsUpdate={setProjectedLabels}
        />

        {/* 3D-to-2D Projected Labels with Leader Lines */}
        <LabelOverlay
          labels={projectedLabels}
          selectedId={selectedId}
          highlightedIds={highlightedIds}
          visible={showLabels}
          onSelect={handleSelectComponent}
          onHoverSound={sound.playHover}
        />

        {/* Side Component Inspector Panel */}
        <InspectorPanel
          selectedId={selectedId}
          open={inspectorOpen}
          onToggleOpen={handleToggleInspector}
          onResetSelection={handleResetSelection}
          onHoverSound={sound.playHover}
          onToggleSound={sound.playToggle}
          onScrubSound={sound.playScrub}
        />

        {/* Bottom Component Selector & Guided Demo Dock */}
        <BottomDock
          selectedId={selectedId}
          highlightedIds={highlightedIds}
          collapsed={dockCollapsed}
          demoActive={demoActive}
          demoPaused={demoPaused}
          demoStepIndex={demoStepIndex}
          onToggleCollapsed={handleToggleDock}
          onSelectComponent={handleSelectComponent}
          onDemoTogglePause={handleDemoTogglePause}
          onDemoPrevStep={handleDemoPrevStep}
          onDemoNextStep={handleDemoNextStep}
          onDemoStop={handleDemoStop}
          onHoverSound={sound.playHover}
        />
      </div>
    </div>
  );
}
