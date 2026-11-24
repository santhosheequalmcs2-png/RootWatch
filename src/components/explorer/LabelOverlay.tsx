import type { ComponentId } from '../../data/componentsData';
import type { ProjectedLabel } from '../../scene/RootWatchViewport';

interface LabelOverlayProps {
  labels: ProjectedLabel[];
  selectedId: ComponentId | null;
  highlightedIds: ComponentId[];
  visible: boolean;
  onSelect: (id: ComponentId) => void;
  onHoverSound: () => void;
}

export function LabelOverlay({
  labels,
  selectedId,
  highlightedIds,
  visible,
  onSelect,
  onHoverSound,
}: LabelOverlayProps) {
  if (!visible || labels.length === 0) return null;

  const activeSet = new Set<ComponentId>(highlightedIds);
  if (selectedId) activeSet.add(selectedId);

  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden select-none">
      {/* Crisp SVG leader lines from 3D anchor points to non-overlapping callout tags */}
      <svg className="absolute inset-0 h-full w-full">
        {labels.map((item) => {
          if (!item.visible) return null;
          const isActive = activeSet.has(item.id);
          const strokeColor = item.experimental
            ? isActive
              ? '#e5a446'
              : 'rgba(229, 164, 70, 0.55)'
            : isActive
              ? '#6ee7a8'
              : 'rgba(155, 206, 174, 0.45)';

          return (
            <g key={item.id}>
              <line
                x1={item.anchorX}
                y1={item.anchorY}
                x2={item.boxX}
                y2={item.boxY}
                stroke={strokeColor}
                strokeWidth={isActive ? 1.5 : 1}
              />
              <circle
                cx={item.anchorX}
                cy={item.anchorY}
                r={isActive ? 3.5 : 2.5}
                fill={strokeColor}
              />
            </g>
          );
        })}
      </svg>

      {/* Interactive semantic DOM label callouts (no backdrop-filter over WebGL) */}
      {labels.map((item) => {
        if (!item.visible) return null;
        const isActive = activeSet.has(item.id);
        const borderClass = item.experimental
          ? isActive
            ? 'border-[#e5a446] bg-[#1e1911] text-[#fce7c3]'
            : 'border-[#8a652d]/70 bg-[#141713]/92 text-[#ecd9b8] hover:border-[#e5a446]'
          : isActive
            ? 'border-[#52b788] bg-[#12261c] text-[#f3f1ea]'
            : 'border-[#2f4b3b] bg-[#0e1713]/92 text-[#d6e2d9] hover:border-[#52b788]';

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            onMouseEnter={onHoverSound}
            style={{
              transform: `translate3d(${Math.round(item.boxX)}px, ${Math.round(item.boxY)}px, 0) translate(-50%, -50%)`,
            }}
            className={`pointer-events-auto absolute top-0 left-0 cursor-pointer rounded-md border px-2.5 py-1 text-xs font-medium whitespace-nowrap shadow-md transition-colors ${borderClass}`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
