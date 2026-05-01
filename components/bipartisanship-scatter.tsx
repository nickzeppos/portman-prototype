'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { scaleLinear } from 'd3-scale';
import { Jost } from 'next/font/google';
import Link from 'next/link';
import type { LegislatorRow } from '@/lib/scores';

const jost = Jost({ subsets: ['latin'], weight: ['500', '600', '700'] });

const PARTY_FILL: Record<string, string> = {
  D: 'fill-blue-700',
  R: 'fill-red-700',
  I: 'fill-gray-500',
};

const W = 720;
const H = 480;
const M = { top: 30, right: 30, bottom: 60, left: 70 };
const innerW = W - M.left - M.right;
const innerH = H - M.top - M.bottom;

export function BipartisanshipScatter({
  rows,
  highlighted,
  title,
  maxWidth = 928,
  align = 'center',
}: {
  rows: LegislatorRow[];
  // null → no highlight (everyone full opacity, no strokes).
  // function → matching rows are lit + stroked, others dimmed.
  highlighted: ((row: LegislatorRow) => boolean) | null;
  title: string;
  maxWidth?: number;
  align?: 'center' | 'left';
}) {
  // Domain extends to -0.1 so points near 0 don't sit on the axis. Ticks are
  // generated only over [0, 1] so the negative breathing room isn't labeled.
  const xScale = useMemo(
    () => scaleLinear().domain([-0.05, 1]).range([0, innerW]),
    [],
  );
  const yScale = useMemo(
    () => scaleLinear().domain([-0.05, 1]).range([innerH, 0]),
    [],
  );
  const xTicks = useMemo(
    () => scaleLinear().domain([0, 1]).ticks(10),
    [],
  );
  const yTicks = useMemo(
    () => scaleLinear().domain([0, 1]).ticks(10),
    [],
  );

  // When `rows` changes (chamber or congress toggle), fade the whole circles
  // group out, swap to the new rows, then fade back in. State-highlight
  // transitions are independent — they animate per-circle opacity inside the
  // group regardless of this group-level fade.
  const [displayedRows, setDisplayedRows] = useState(rows);
  const [groupOpacity, setGroupOpacity] = useState(1);
  useEffect(() => {
    if (rows === displayedRows) return;
    setGroupOpacity(0);
    const t = setTimeout(() => {
      setDisplayedRows(rows);
      requestAnimationFrame(() => setGroupOpacity(1));
    }, 300);
    return () => clearTimeout(t);
  }, [rows, displayedRows]);

  // Keep row order stable regardless of highlight state — only the per-row
  // `dim` flag changes. Reordering the array forces React to move DOM nodes,
  // which resets CSS transitions and makes opacity changes snap instead of
  // ease.
  const drawn = useMemo(
    () =>
      displayedRows.map((r) => ({
        row: r,
        dim: highlighted !== null && !highlighted(r),
      })),
    [displayedRows, highlighted],
  );

  // Click-to-pin tooltip. Hover only signals affordance via cursor-pointer;
  // committing to inspect a dot requires a click. Click on empty SVG area or
  // outside the chart wrapper dismisses. Toggle whenever rows change.
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<{
    row: LegislatorRow;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    setSelected(null);
  }, [rows]);

  useEffect(() => {
    if (!selected) return;
    function onClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setSelected(null);
      }
    }
    // Defer to skip the click that opened the tooltip.
    const t = setTimeout(
      () => document.addEventListener('mousedown', onClick),
      0,
    );
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', onClick);
    };
  }, [selected]);

  const handleCircleClick = (
    e: ReactMouseEvent<SVGCircleElement>,
    row: LegislatorRow,
  ) => {
    e.stopPropagation();
    const svg = e.currentTarget.ownerSVGElement;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    setSelected({
      row,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const fmtScore = (v: number | null) => (v == null ? '—' : v.toFixed(3));

  return (
    <section
      className={`mb-6 w-full ${align === 'left' ? '' : 'mx-auto'}`}
      style={{ maxWidth: `${maxWidth}px` }}
    >
      <h2
        className={`${jost.className} mb-1 text-lg font-bold uppercase tracking-wider text-gray-800`}
      >
        {title}
      </h2>
      <div className="mb-2 flex items-center gap-4 text-xs text-gray-700">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full bg-blue-700" />D
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full bg-red-700" />R
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full bg-gray-500" />I
        </span>
      </div>
      <div ref={wrapperRef} className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        onClick={() => setSelected(null)}
      >
        <g transform={`translate(${M.left}, ${M.top})`}>
          {/* Gridlines span the full inner area so the breathing-room region
              shares the same grid as the data region. */}
          {xTicks.map((t) => (
            <line
              key={`gx-${t}`}
              x1={xScale(t)}
              x2={xScale(t)}
              y1={0}
              y2={innerH}
              className="stroke-gray-200"
              strokeWidth={1}
            />
          ))}
          {yTicks.map((t) => (
            <line
              key={`gy-${t}`}
              x1={0}
              x2={innerW}
              y1={yScale(t)}
              y2={yScale(t)}
              className="stroke-gray-200"
              strokeWidth={1}
            />
          ))}

          <g
            className="transition-opacity duration-300"
            style={{ opacity: groupOpacity }}
          >
            {drawn.map(({ row, dim }) => {
              if (row.attractScore == null || row.offerScore == null)
                return null;
              const lit = highlighted !== null && !dim;
              return (
                <circle
                  key={row.bioguide}
                  cx={xScale(row.attractScore)}
                  cy={yScale(row.offerScore)}
                  r={4}
                  onClick={(e) => handleCircleClick(e, row)}
                  className={`${PARTY_FILL[row.party] ?? 'fill-gray-500'} cursor-pointer transition-[fill-opacity] duration-300`}
                  style={{
                    fillOpacity: dim ? 0.1 : lit ? 1 : 0.85,
                  }}
                />
              );
            })}
          </g>

          {/* Axis lines at the inner-area edges. The 0 tick sits inside the
              chart (at xScale(0) / yScale(0)), giving points at (0, 0) visible
              daylight from the axes. */}
          <line
            x1={0}
            x2={innerW}
            y1={innerH}
            y2={innerH}
            className="stroke-gray-400"
          />
          {xTicks.map((t) => (
            <g key={`tx-${t}`} transform={`translate(${xScale(t)}, ${innerH})`}>
              <line y1={0} y2={6} className="stroke-gray-400" />
              <text
                y={20}
                textAnchor="middle"
                className="fill-gray-500 text-[10px]"
              >
                {t.toFixed(1)}
              </text>
            </g>
          ))}

          <line
            x1={0}
            x2={0}
            y1={0}
            y2={innerH}
            className="stroke-gray-400"
          />
          {yTicks.map((t) => (
            <g key={`ty-${t}`} transform={`translate(0, ${yScale(t)})`}>
              <line x1={-6} x2={0} className="stroke-gray-400" />
              <text
                x={-10}
                dy="0.32em"
                textAnchor="end"
                className="fill-gray-500 text-[10px]"
              >
                {t.toFixed(1)}
              </text>
            </g>
          ))}

          <text
            x={innerW}
            y={innerH + 45}
            textAnchor="end"
            className={`${jost.className} fill-gray-700 text-xs font-bold uppercase tracking-wider`}
          >
            Bipartisanship Attracted
          </text>
          <text
            transform={`translate(${-50}, 0) rotate(-90)`}
            textAnchor="end"
            className={`${jost.className} fill-gray-700 text-xs font-bold uppercase tracking-wider`}
          >
            Bipartisanship Offered
          </text>
        </g>
      </svg>
        {selected && (
          <Link
            href={`/legislator/${selected.row.bioguide}`}
            className="group absolute z-10 -translate-y-full whitespace-nowrap rounded bg-gray-900 px-2.5 py-1.5 text-xs text-white shadow-lg"
            style={{ left: selected.x + 12, top: selected.y - 8 }}
          >
            <div className="font-semibold underline-offset-2 group-hover:underline">
              {selected.row.name}
            </div>
            <div className="font-mono text-[10px] text-gray-300">
              attract {fmtScore(selected.row.attractScore)} · offer{' '}
              {fmtScore(selected.row.offerScore)}
            </div>
          </Link>
        )}
      </div>
    </section>
  );
}
