import * as d3 from 'd3';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ComponentId } from '../../data/componentsData';
import {
  SENSOR_HISTORY_PROFILES,
  type SensorDataPoint,
  type TimeframeKey,
} from '../../data/sensorHistoryData';

interface SensorHistoryChartProps {
  componentId: ComponentId;
  onToggleSound?: (active: boolean) => void;
  onScrubSound?: () => void;
}

const CHART_WIDTH = 288;
const CHART_HEIGHT = 148;
const MARGIN = { top: 10, right: 10, bottom: 24, left: 36 };
const INNER_WIDTH = CHART_WIDTH - MARGIN.left - MARGIN.right;
const INNER_HEIGHT = CHART_HEIGHT - MARGIN.top - MARGIN.bottom;

export function SensorHistoryChart({
  componentId,
  onToggleSound,
  onScrubSound,
}: SensorHistoryChartProps) {
  const profile = SENSOR_HISTORY_PROFILES[componentId];
  const [timeframe, setTimeframe] = useState<TimeframeKey>('24h');
  const [hoveredPoint, setHoveredPoint] = useState<SensorDataPoint | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const lastScrubIdxRef = useRef<number | null>(null);
  const onScrubSoundRef = useRef(onScrubSound);
  onScrubSoundRef.current = onScrubSound;
  const gradientId = useId().replace(/:/g, '');

  const data = useMemo(() => {
    if (!profile) return [];
    return profile.series[timeframe];
  }, [profile, timeframe]);

  // Clear stale hover point when switching sensors or timeframe
  useEffect(() => {
    setHoveredPoint(null);
  }, [componentId, timeframe]);

  const stats = useMemo(() => {
    if (data.length === 0) return null;
    let min = data[0].value;
    let max = data[0].value;
    for (let i = 1; i < data.length; i++) {
      if (data[i].value < min) min = data[i].value;
      if (data[i].value > max) max = data[i].value;
    }
    return {
      latest: data[data.length - 1],
      min,
      max,
    };
  }, [data]);

  useEffect(() => {
    if (!profile || !svgRef.current || data.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const accentStroke = profile.experimental ? '#e5a446' : '#5fd39a';
    const accentGlow = profile.experimental ? '#e5a446' : '#52b788';
    const bandFill = profile.experimental
      ? 'rgba(229, 164, 70, 0.08)'
      : 'rgba(82, 183, 136, 0.09)';

    const xScale = d3
      .scaleLinear()
      .domain([0, data.length - 1])
      .range([0, INNER_WIDTH]);

    const yScale = d3
      .scaleLinear()
      .domain(profile.domain)
      .range([INNER_HEIGHT, 0]);

    // Area fill gradient definition
    const defs = svg.append('defs');
    const grad = defs
      .append('linearGradient')
      .attr('id', gradientId)
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');

    grad
      .append('stop')
      .attr('offset', '0%')
      .attr('stop-color', accentGlow)
      .attr('stop-opacity', 0.28);
    grad
      .append('stop')
      .attr('offset', '100%')
      .attr('stop-color', accentGlow)
      .attr('stop-opacity', 0.01);

    const g = svg
      .append('g')
      .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    // Subtle horizontal grid lines
    const yTicks = yScale.ticks(4);
    g.append('g')
      .attr('class', 'grid')
      .selectAll('line')
      .data(yTicks)
      .join('line')
      .attr('x1', 0)
      .attr('x2', INNER_WIDTH)
      .attr('y1', (d) => yScale(d))
      .attr('y2', (d) => yScale(d))
      .attr('stroke', 'rgba(140, 197, 158, 0.12)')
      .attr('stroke-dasharray', '2,3');

    // Optional agronomic target / optimal reference band
    if (profile.referenceBand) {
      const bandTop = yScale(profile.referenceBand.max);
      const bandBottom = yScale(profile.referenceBand.min);
      g.append('rect')
        .attr('x', 0)
        .attr('y', bandTop)
        .attr('width', INNER_WIDTH)
        .attr('height', Math.max(0, bandBottom - bandTop))
        .attr('fill', bandFill);

      g.append('text')
        .attr('x', INNER_WIDTH - 4)
        .attr('y', bandTop + 10)
        .attr('text-anchor', 'end')
        .attr('fill', 'rgba(146, 189, 162, 0.72)')
        .attr('font-size', '9px')
        .attr('font-family', 'IBM Plex Mono, monospace')
        .text(profile.referenceBand.label);
    }

    // Y Axis
    const yAxis = d3
      .axisLeft(yScale)
      .ticks(4)
      .tickSize(0)
      .tickPadding(6)
      .tickFormat((d) => {
        const num = Number(d);
        return profile.decimals >= 2 ? num.toFixed(1) : String(num);
      });

    const yAxisGroup = g.append('g').call(yAxis);
    yAxisGroup.select('.domain').remove();
    yAxisGroup
      .selectAll('text')
      .attr('fill', '#7f9c8b')
      .attr('font-size', '9.5px')
      .attr('font-family', 'IBM Plex Mono, monospace');

    // X Axis (4 clean evenly spaced time ticks)
    const tickIndices = [0, 4, 8, 12];
    const xAxis = d3
      .axisBottom(xScale)
      .tickValues(tickIndices)
      .tickSize(0)
      .tickPadding(8)
      .tickFormat((idx) => {
        const pt = data[Number(idx)];
        return pt ? pt.label : '';
      });

    const xAxisGroup = g
      .append('g')
      .attr('transform', `translate(0,${INNER_HEIGHT})`)
      .call(xAxis);
    xAxisGroup.select('.domain').attr('stroke', 'rgba(140, 197, 158, 0.2)');
    xAxisGroup
      .selectAll('text')
      .attr('fill', '#7f9c8b')
      .attr('font-size', '9.5px')
      .attr('font-family', 'IBM Plex Mono, monospace');

    // D3 Area generator
    const areaGenerator = d3
      .area<SensorDataPoint>()
      .x((d) => xScale(d.index))
      .y0(INNER_HEIGHT)
      .y1((d) => yScale(d.value))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(data)
      .attr('fill', `url(#${gradientId})`)
      .attr('d', areaGenerator);

    // D3 Line generator
    const lineGenerator = d3
      .line<SensorDataPoint>()
      .x((d) => xScale(d.index))
      .y((d) => yScale(d.value))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', accentStroke)
      .attr('stroke-width', 1.9)
      .attr('stroke-linecap', 'round')
      .attr('stroke-linejoin', 'round')
      .attr('d', lineGenerator);

    // Static endpoint marker on latest sample
    const lastPt = data[data.length - 1];
    const endpointDot = g
      .append('circle')
      .attr('cx', xScale(lastPt.index))
      .attr('cy', yScale(lastPt.value))
      .attr('r', 3)
      .attr('fill', accentStroke)
      .attr('stroke', '#0c1510')
      .attr('stroke-width', 1.5);

    // Interactive hover scrubber layer
    const hoverGroup = g.append('g').style('display', 'none');
    const hoverLine = hoverGroup
      .append('line')
      .attr('y1', 0)
      .attr('y2', INNER_HEIGHT)
      .attr('stroke', 'rgba(243, 241, 234, 0.32)')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '2,2');

    const hoverDot = hoverGroup
      .append('circle')
      .attr('r', 4)
      .attr('fill', accentStroke)
      .attr('stroke', '#f3f1ea')
      .attr('stroke-width', 1.5);

    g.append('rect')
      .attr('width', INNER_WIDTH)
      .attr('height', INNER_HEIGHT)
      .attr('fill', 'transparent')
      .style('cursor', 'crosshair')
      .on('pointermove', (event: PointerEvent) => {
        const [mx] = d3.pointer(event);
        const rawIdx = Math.round(xScale.invert(mx));
        const clampedIdx = Math.max(0, Math.min(data.length - 1, rawIdx));
        const pt = data[clampedIdx];
        if (!pt) return;

        if (lastScrubIdxRef.current !== clampedIdx) {
          lastScrubIdxRef.current = clampedIdx;
          onScrubSoundRef.current?.();
        }

        const cx = xScale(pt.index);
        const cy = yScale(pt.value);
        hoverGroup.style('display', null);
        endpointDot.style('opacity', 0.35);
        hoverLine.attr('x1', cx).attr('x2', cx);
        hoverDot.attr('cx', cx).attr('cy', cy);
        setHoveredPoint(pt);
      })
      .on('pointerleave', () => {
        lastScrubIdxRef.current = null;
        hoverGroup.style('display', 'none');
        endpointDot.style('opacity', 1);
        setHoveredPoint(null);
      });
  }, [profile, data, gradientId]);

  if (!profile || !stats) return null;

  const activePoint = hoveredPoint ?? stats.latest;
  const formatVal = (val: number) => `${val.toFixed(profile.decimals)} ${profile.unit}`;

  return (
    <section
      aria-label={`${profile.metricName} simulated historical chart`}
      className="border-t border-[#8cc59e]/14 pt-3.5"
    >
      {/* Header row with title and 24h / 7d timeframe switch */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-xs font-semibold text-[#89ab96]">Simulated Trend</h3>
          <p className="truncate text-xs text-[#cfdcd3]">{profile.metricName}</p>
        </div>

        <div
          className="flex shrink-0 items-center rounded-md border border-[#8cc59e]/18 bg-[#0f1914] p-0.5"
          role="group"
          aria-label="Chart timeframe"
        >
          {(['24h', '7d'] as TimeframeKey[]).map((tf) => (
            <button
              key={tf}
              type="button"
              onClick={() => {
                if (timeframe !== tf) {
                  onToggleSound?.(tf === '7d');
                  setTimeframe(tf);
                }
              }}
              className={`cursor-pointer rounded px-2 py-0.5 font-mono text-[11px] font-medium whitespace-nowrap transition-colors ${
                timeframe === tf
                  ? profile.experimental
                    ? 'bg-[#3a2811] text-[#fce7c3]'
                    : 'bg-[#214533] text-[#f3f1ea]'
                  : 'text-[#8ea899] hover:text-[#f3f1ea]'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Active / Scrubbed tabular numeric readout */}
      <div className="mt-2.5 flex items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <span
            className={`font-mono text-base font-semibold tabular-nums ${
              profile.experimental ? 'text-[#f5bd68]' : 'text-[#6ee7a8]'
            }`}
          >
            {formatVal(activePoint.value)}
          </span>
          <span className="font-mono text-[11px] text-[#89ab96] tabular-nums">
            {hoveredPoint ? activePoint.label : `Latest · ${activePoint.label}`}
          </span>
        </div>

        <div className="flex items-center gap-1.5 font-mono text-[10.5px] text-[#829f8d] tabular-nums">
          <span>{stats.min.toFixed(profile.decimals)}</span>
          <span aria-hidden="true">–</span>
          <span>{stats.max.toFixed(profile.decimals)}</span>
        </div>
      </div>

      {/* D3 SVG Line Chart */}
      <div className="mt-2 rounded-lg border border-[#8cc59e]/12 bg-[#0a120e] px-1 pt-1.5 pb-1">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          className="h-auto w-full overflow-visible select-none"
          role="img"
          aria-label={`Line chart of ${profile.metricName} over ${timeframe}`}
        />
      </div>

      {/* Contextual agronomic caption + simulated disclosure */}
      <p className="mt-1.5 text-[11px] leading-relaxed text-[#8ba596]">
        {profile.caption}
      </p>
    </section>
  );
}
