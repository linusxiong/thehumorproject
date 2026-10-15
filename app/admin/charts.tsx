"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

// Small, dependency-free charts for the admin dashboard. Marks follow one spec: columns at most 24px wide with
// 4px rounded data ends, 2px lines, hairline gridlines, values in text colors, and a hover/focus readout.

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

// Round an axis maximum up to 1, 2, or 5 times a power of ten.
function niceMax(value: number) {
  if (value <= 4) return 4;
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((candidate) => candidate * power >= value / 4)! * power;
  return Math.ceil(value / step) * step;
}

// label is the axis text; tooltip, when set, replaces it in the readout and the data table (e.g. "Week of Oct 3").
export type ColumnDatum = { key: string; label: string; value: number; tooltip?: string };

// Column chart with a left axis, sparse date labels, and one readout for the hovered or focused column.
// Arrow keys move the readout when the chart has focus; a visually hidden table lists every value.
export function ColumnChart({ data, color, ariaLabel, formatValue, height = 220 }: {
  data: ColumnDatum[]; color: string; ariaLabel: string; formatValue: (value: number) => string; height?: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const axisWidth = 36;
  const bottom = 24;
  const top = 8;
  const plotWidth = Math.max(0, width - axisWidth);
  const plotHeight = height - top - bottom;
  const max = niceMax(Math.max(0, ...data.map((datum) => datum.value)));
  const ticks = [0, max / 4, max / 2, (3 * max) / 4, max];
  const slot = data.length > 0 ? plotWidth / data.length : 0;
  const barWidth = Math.max(1, Math.min(24, slot - 2));
  const labelEvery = Math.max(1, Math.ceil(56 / Math.max(slot, 1)));
  const y = (value: number) => top + plotHeight - (value / max) * plotHeight;
  const shown = active === null ? null : data[active];

  function onKeyDown(event: KeyboardEvent) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const step = event.key === "ArrowRight" ? 1 : -1;
    setActive((current) => Math.min(data.length - 1, Math.max(0, (current ?? data.length) + step)));
  }

  return (
    <div ref={ref} className="relative w-full" style={{ height }} tabIndex={0} role="group" aria-label={ariaLabel}
      onKeyDown={onKeyDown} onBlur={() => setActive(null)} onPointerLeave={() => setActive(null)}>
      {width > 0 && (
        <svg width={width} height={height} aria-hidden="true" className="overflow-visible">
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={axisWidth} x2={width} y1={y(tick)} y2={y(tick)} stroke="var(--separator)" strokeWidth={1} />
              <text x={axisWidth - 8} y={y(tick)} dy="0.32em" textAnchor="end" className="fill-muted text-[11px] tabular-nums">
                {formatValue(tick)}
              </text>
            </g>
          ))}
          {data.map((datum, index) => {
            const x = axisWidth + index * slot + (slot - barWidth) / 2;
            const barHeight = (datum.value / max) * plotHeight;
            const radius = Math.min(4, barWidth / 2, barHeight);
            const baseline = top + plotHeight;
            return (
              <g key={datum.key}>
                {barHeight > 0 && (
                  <path fill={color} opacity={active === null || active === index ? 1 : 0.45}
                    d={`M${x},${baseline}V${baseline - barHeight + radius}q0,-${radius} ${radius},-${radius}h${barWidth - 2 * radius}q${radius},0 ${radius},${radius}V${baseline}Z`} />
                )}
                {index % labelEvery === 0 && (
                  <text x={x + barWidth / 2} y={height - 6} textAnchor="middle" className="fill-muted text-[11px]">{datum.label}</text>
                )}
                {/* The hit target spans the whole slot and plot height, not just the painted column. */}
                <rect x={axisWidth + index * slot} y={top} width={slot} height={plotHeight} fill="transparent"
                  onPointerEnter={() => setActive(index)} />
              </g>
            );
          })}
          {shown && active !== null && (
            <line x1={axisWidth + active * slot + slot / 2} x2={axisWidth + active * slot + slot / 2} y1={top} y2={top + plotHeight}
              stroke="var(--border)" strokeWidth={1} pointerEvents="none" />
          )}
        </svg>
      )}
      {shown && active !== null && (
        <div role="status" className="pointer-events-none absolute top-0 z-10 flex -translate-x-1/2 flex-col rounded-lg bg-overlay px-2.5 py-1.5 shadow-md"
          style={{ left: Math.min(Math.max(axisWidth + active * slot + slot / 2, 60), Math.max(60, width - 60)) }}>
          <span className="text-sm font-semibold tabular-nums">{formatValue(shown.value)}</span>
          <span className="text-xs text-muted">{shown.tooltip ?? shown.label}</span>
        </div>
      )}
      <table className="sr-only">
        <caption>{ariaLabel}</caption>
        <tbody>
          {data.map((datum) => <tr key={datum.key}><th scope="row">{datum.tooltip ?? datum.label}</th><td>{formatValue(datum.value)}</td></tr>)}
        </tbody>
      </table>
    </div>
  );
}

// Decorative 2px trend line with a 10% wash; the tile beside it carries the numbers.
export function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;
  const max = Math.max(1, ...values);
  const points = values.map((value, index) => `${(index / (values.length - 1)) * 100},${38 - (value / max) * 34}`);
  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-10 w-full" aria-hidden="true">
      <path d={`M0,40L${points.join("L")}L100,40Z`} fill={color} opacity={0.1} />
      <path d={`M${points.join("L")}`} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export type BarRow = { key: string; label: ReactNode; value: number; display: string; color: string; detail?: string };

// Horizontal bars with the label above and the value at the bar's end. An optional reference marks a baseline value.
export function BarRows({ rows, max, reference }: { rows: BarRow[]; max?: number; reference?: { value: number; label: string } }) {
  const top = max ?? Math.max(1, ...rows.map((row) => row.value), reference?.value ?? 0);
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row) => (
        <li key={row.key} className="flex flex-col gap-1" title={row.detail}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">{row.label}</span>
            <span className="shrink-0 font-medium tabular-nums">{row.display}</span>
          </div>
          <div className="relative h-2.5 w-full">
            {row.value > 0 && (
              <div className="absolute inset-y-0 left-0 rounded-e-[4px] transition-[width]" style={{ width: `${(row.value / top) * 100}%`, background: row.color }} />
            )}
            {reference && (
              <div className="absolute -inset-y-1 w-px bg-foreground/40" style={{ left: `${(reference.value / top) * 100}%` }} aria-hidden="true" />
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

export type Segment = { key: string; label: string; value: number; color: string };

// A 100% stacked bar: 2px surface gaps between segments, and a readout for the hovered segment.
export function StackedBar({ segments, describe }: { segments: Segment[]; describe: (segment: Segment, share: number) => string }) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const [active, setActive] = useState<string | null>(null);
  if (total === 0) return <div className="h-3 w-full rounded-[4px] bg-default" />;
  const shown = segments.find((segment) => segment.key === active);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex h-3 w-full gap-0.5" onPointerLeave={() => setActive(null)}>
        {segments.filter((segment) => segment.value > 0).map((segment) => (
          <div key={segment.key} className="h-full first:rounded-s-[4px] last:rounded-e-[4px]" title={describe(segment, segment.value / total)}
            style={{ width: `${(segment.value / total) * 100}%`, background: segment.color, opacity: active && active !== segment.key ? 0.5 : 1 }}
            onPointerEnter={() => setActive(segment.key)} />
        ))}
      </div>
      <span className="min-h-4 text-xs text-muted" aria-live="polite">{shown ? describe(shown, shown.value / total) : ""}</span>
    </div>
  );
}

// Legend swatches for multi-series charts: a mark beside text, never colored text.
export function Legend({ items }: { items: { key: string; label: string; color: string }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
      {items.map((item) => (
        <li key={item.key} className="flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2.5 rounded-[3px]" style={{ background: item.color }} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
