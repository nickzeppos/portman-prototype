'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { scaleLinear } from 'd3-scale';
import { ordinal } from '@/lib/format';
import { effectiveParty } from '@/lib/scores';
import type { LegislatorMembership } from './legislator-detail';
import type { Basis } from './basis-dropdown';

const DEFAULT_W = 760;
const DEFAULT_H = 130;
const M = { top: 28, right: 16, bottom: 30, left: 16 };

// Number of congress ticks visible in the viewport at once. The selected
// congress sits in the middle, with (VISIBLE_COUNT-1)/2 neighbors on each
// side. UNIT_WIDTH is derived from the actual width inside the component
// so the spacing scales with the SVG, keeping the same number of ticks
// visible regardless of the caller's chosen size.
const VISIBLE_COUNT = 3;

// Matches the BipartisanshipScatter's full fade-out → swap → fade-in window
// so the timeline scroll completes alongside the new chart settling in.
const TRANSITION_MS = 600;

type Metric = 'attract' | 'offer';

type SparkPoint = {
  congress: number;
  attract: number | null;
  offer: number | null;
};

function pctFromRank(rank: number | null, total: number): number | null {
  if (rank == null || total < 2) return rank == null ? null : 0.5;
  return 1 - (rank - 1) / (total - 1);
}

function pointsForMetric(points: SparkPoint[], metric: Metric) {
  return points
    .filter((p) => p[metric] !== null)
    .map((p) => ({ congress: p.congress, value: p[metric] as number }));
}

const STROKE: Record<Metric, string> = {
  attract: 'stroke-brand',
  offer: 'stroke-gray-700',
};

const FILL: Record<Metric, string> = {
  attract: 'fill-brand',
  offer: 'fill-gray-700',
};

export function CareerSparkline({
  memberships,
  currentCongress,
  onCongressChange,
  width = DEFAULT_W,
  height = DEFAULT_H,
  vertical = false,
  basis = 'chamber',
}: {
  memberships: LegislatorMembership[];
  currentCongress: number;
  onCongressChange: (c: number) => void;
  width?: number;
  height?: number;
  vertical?: boolean;
  basis?: Basis;
}) {
  const W = width;
  const H = height;
  const innerW = W - M.left - M.right;
  const innerH = H - M.top - M.bottom;
  const UNIT_WIDTH = innerW / VISIBLE_COUNT;
  // When the SVG itself is CSS-rotated 90° CW by a parent wrapper, every
  // <text> needs an SVG-local CCW 90° rotation around its own anchor so
  // glyphs read upright in the page. Two rotations cancel; the anchor stays
  // pinned in SVG-local coords so it tracks the data layer's offset.
  const rotText = (x: number, y: number): string | undefined =>
    vertical ? `rotate(-90 ${x} ${y})` : undefined;
  // Target percentiles for the current basis. When basis flips, displayed
  // points lerp toward this target so dots and polylines glide rather than
  // snap to their new vertical positions.
  const targetPoints: SparkPoint[] = useMemo(
    () =>
      memberships
        .map((m) => {
          const myParty = effectiveParty(m.row.party);
          const inPool = (x: { party: string }) =>
            basis === 'chamber' || effectiveParty(x.party) === myParty;
          const totalAttract = m.chamberMembers.filter(
            (x) => x.attractScore !== null && inPool(x),
          ).length;
          const totalOffer = m.chamberMembers.filter(
            (x) => x.offerScore !== null && inPool(x),
          ).length;
          const attractRank =
            basis === 'chamber' ? m.row.attractRank : m.row.attractRankParty;
          const offerRank =
            basis === 'chamber' ? m.row.offerRank : m.row.offerRankParty;
          return {
            congress: m.congress,
            attract: pctFromRank(attractRank, totalAttract),
            offer: pctFromRank(offerRank, totalOffer),
          };
        })
        .sort((a, b) => a.congress - b.congress),
    [memberships, basis],
  );

  const [points, setPoints] = useState<SparkPoint[]>(targetPoints);
  const pointsRef = useRef(points);
  pointsRef.current = points;
  const animRef = useRef<number | null>(null);
  const didMountRef = useRef(false);

  // Tween from the previously-displayed points to the new target on basis
  // (or membership) changes. Same-position values pass through unchanged;
  // null↔value transitions snap rather than ease since the y-axis has no
  // meaningful midpoint between "unranked" and a percentile.
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      setPoints(targetPoints);
      return;
    }
    if (animRef.current !== null) cancelAnimationFrame(animRef.current);
    const startPoints = pointsRef.current;
    const startTime = performance.now();
    const ease = (t: number) => 0.5 * (1 - Math.cos(Math.PI * t));

    const lerp = (a: number | null, b: number | null, e: number) => {
      if (b === null) return null;
      if (a === null) return b;
      return a + (b - a) * e;
    };

    const tick = () => {
      const progress = Math.min(
        1,
        (performance.now() - startTime) / TRANSITION_MS,
      );
      const e = ease(progress);
      const interpolated: SparkPoint[] = targetPoints.map((tp) => {
        const sp = startPoints.find((p) => p.congress === tp.congress);
        return {
          congress: tp.congress,
          attract: lerp(sp?.attract ?? null, tp.attract, e),
          offer: lerp(sp?.offer ?? null, tp.offer, e),
        };
      });
      setPoints(interpolated);
      if (progress < 1) {
        animRef.current = requestAnimationFrame(tick);
      } else {
        animRef.current = null;
      }
    };
    animRef.current = requestAnimationFrame(tick);

    return () => {
      if (animRef.current !== null) {
        cancelAnimationFrame(animRef.current);
        animRef.current = null;
      }
    };
  }, [targetPoints]);

  // Served congresses drive the x-axis. Discontinuous gaps (e.g., 113 →
  // 116) collapse to adjacent ticks; a jagged break marker indicates the
  // skip on the implied axis between them. Sourced from targetPoints so the
  // axis stays stable while displayed points are tweening.
  const served = useMemo(
    () => targetPoints.map((p) => p.congress),
    [targetPoints],
  );

  const breakXs = useMemo(() => {
    const out: number[] = [];
    for (let i = 0; i < served.length - 1; i++) {
      if (served[i + 1] - served[i] > 1) {
        out.push((i + 0.5) * UNIT_WIDTH);
      }
    }
    return out;
  }, [served, UNIT_WIDTH]);

  const hasAnyData = targetPoints.some(
    (p) => p.attract !== null || p.offer !== null,
  );
  if (!hasAnyData) return null;

  const xPos = (congress: number) =>
    served.indexOf(congress) * UNIT_WIDTH;

  const yScale = scaleLinear().domain([0, 1]).range([innerH, 0]);

  const attractPoints = pointsForMetric(points, 'attract');
  const offerPoints = pointsForMetric(points, 'offer');

  // Scroll the data layer so the current congress sits at viewport center.
  const offset = innerW / 2 - xPos(currentCongress);

  return (
    <div className="w-full max-w-4xl">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        <defs>
          <clipPath id="career-spark-clip">
            <rect x={0} y={-20} width={innerW} height={H + 30} />
          </clipPath>
        </defs>
        <g transform={`translate(${M.left}, ${M.top})`}>
          {/* Static selection band — fixed at viewport center, one
              congress-unit wide. Spans only the score-axis range (0 → 100
              percentile rails); the congress-number area below sits
              outside the band. */}
          <rect
            x={innerW / 2 - UNIT_WIDTH / 2}
            y={yScale(1)}
            width={UNIT_WIDTH}
            height={yScale(0) - yScale(1)}
            className="fill-gray-100"
          />

          <g clipPath="url(#career-spark-clip)">
            {/* Score-axis reference line at the 0 percentile. Lives inside
                the clip (so it truncates to the visible time range) but
                outside the offset translate so it holds a fixed position
                as time scrolls. */}
            <line
              x1={0}
              x2={innerW}
              y1={yScale(0)}
              y2={yScale(0)}
              strokeWidth={1}
              strokeDasharray="2 3"
              className="stroke-gray-300"
            />

            <g
              className="transition-transform ease-in-out"
              style={{
                transform: `translate(${offset}px, 0)`,
                transitionDuration: `${TRANSITION_MS}ms`,
              }}
            >
              {attractPoints.length > 0 && (
                <polyline
                  points={attractPoints
                    .map((p) => `${xPos(p.congress)},${yScale(p.value)}`)
                    .join(' ')}
                  fill="none"
                  strokeWidth={1.5}
                  strokeOpacity={0.35}
                  className={STROKE.attract}
                />
              )}
              {offerPoints.length > 0 && (
                <polyline
                  points={offerPoints
                    .map((p) => `${xPos(p.congress)},${yScale(p.value)}`)
                    .join(' ')}
                  fill="none"
                  strokeWidth={1.5}
                  strokeOpacity={0.35}
                  className={STROKE.offer}
                />
              )}

              {points.map((p) => {
                const isCurrent = p.congress === currentCongress;
                const dotStyle = {
                  opacity: isCurrent ? 1 : 0.35,
                  transitionDuration: `${TRANSITION_MS}ms`,
                };
                return (
                  <g key={`pt-${p.congress}`}>
                    {p.attract !== null && (
                      <circle
                        cx={xPos(p.congress)}
                        cy={yScale(p.attract)}
                        r={3}
                        className={`${FILL.attract} transition-opacity ease-in-out`}
                        style={dotStyle}
                      />
                    )}
                    {p.offer !== null && (
                      <circle
                        cx={xPos(p.congress)}
                        cy={yScale(p.offer)}
                        r={3}
                        className={`${FILL.offer} transition-opacity ease-in-out`}
                        style={dotStyle}
                      />
                    )}
                  </g>
                );
              })}

              {/* Discontinuity break markers between non-consecutive served
                  congresses — small parallel slashes on the implied axis. */}
              {breakXs.map((bx, i) => (
                <g
                  key={`break-${i}`}
                  transform={`translate(${bx}, ${innerH + 14})`}
                >
                  <line
                    x1={-3}
                    y1={4}
                    x2={-1}
                    y2={-4}
                    strokeWidth={1}
                    className="stroke-gray-400"
                  />
                  <line
                    x1={1}
                    y1={4}
                    x2={3}
                    y2={-4}
                    strokeWidth={1}
                    className="stroke-gray-400"
                  />
                </g>
              ))}

              {served.map((c) => {
                const tx = xPos(c);
                const ty = innerH + 16;
                return (
                  <text
                    key={`tx-${c}`}
                    x={tx}
                    y={ty}
                    textAnchor="middle"
                    transform={rotText(tx, ty)}
                    className={`text-[10px] transition-colors ease-in-out ${
                      c === currentCongress
                        ? 'fill-gray-900 font-semibold'
                        : 'fill-gray-500'
                    }`}
                    style={{ transitionDuration: `${TRANSITION_MS}ms` }}
                  >
                    {c}
                  </text>
                );
              })}

              {/* Click targets per served congress — overlay last so they
                  capture pointer events ahead of the visual elements. */}
              {served.map((c) => (
                <rect
                  key={`click-${c}`}
                  x={xPos(c) - UNIT_WIDTH / 2}
                  y={-12}
                  width={UNIT_WIDTH}
                  height={innerH + 28}
                  fill="transparent"
                  className="cursor-pointer"
                  onClick={() => onCongressChange(c)}
                  aria-label={`${c}th Congress`}
                />
              ))}
            </g>
          </g>
        </g>
      </svg>
    </div>
  );
}

// Rendered separately by callers (e.g., outside a rotated wrapper) so the
// legend reads horizontally regardless of the chart's orientation. Each row
// reads "<Metric> · <Nth> Percentile" for the current congress, with the
// number cross-fading between congress selections.
export function CareerSparklineLegend({
  memberships,
  currentCongress,
  basis = 'chamber',
}: {
  memberships: LegislatorMembership[];
  currentCongress: number;
  basis?: Basis;
}) {
  const points: SparkPoint[] = memberships.map((m) => {
    const myParty = effectiveParty(m.row.party);
    const inPool = (x: { party: string }) =>
      basis === 'chamber' || effectiveParty(x.party) === myParty;
    const totalAttract = m.chamberMembers.filter(
      (x) => x.attractScore !== null && inPool(x),
    ).length;
    const totalOffer = m.chamberMembers.filter(
      (x) => x.offerScore !== null && inPool(x),
    ).length;
    const attractRank =
      basis === 'chamber' ? m.row.attractRank : m.row.attractRankParty;
    const offerRank =
      basis === 'chamber' ? m.row.offerRank : m.row.offerRankParty;
    return {
      congress: m.congress,
      attract: pctFromRank(attractRank, totalAttract),
      offer: pctFromRank(offerRank, totalOffer),
    };
  });

  // Stack one absolutely-positioned ordinal per congress in a fixed-width
  // slot, right-aligned so the trailing " Percentile" sits at a stable
  // position. The metric label is also wrapped in a fixed-width slot so
  // the percentile column starts at the same x across both rows. Only
  // the current congress's number is opaque; transitions match the
  // dot/band timing.
  const renderPctStack = (metric: Metric) => (
    <span className="relative inline-block min-w-[2.5rem] text-right">
      {points.map((p) =>
        p[metric] != null ? (
          <span
            key={p.congress}
            className="absolute right-0 top-0 transition-opacity ease-in-out"
            style={{
              opacity: p.congress === currentCongress ? 1 : 0,
              transitionDuration: `${TRANSITION_MS}ms`,
            }}
          >
            {ordinal(Math.round((p[metric] as number) * 100))}
          </span>
        ) : null,
      )}
      <span aria-hidden className="invisible">
        100th
      </span>
    </span>
  );

  return (
    <div className="flex flex-col items-start gap-y-1 text-xs">
      <span className="text-brand">
        <span className="inline-block min-w-[3.5rem]">Attract</span>
        {renderPctStack('attract')} Percentile
      </span>
      <span className="text-gray-700">
        <span className="inline-block min-w-[3.5rem]">Offer</span>
        {renderPctStack('offer')} Percentile
      </span>
    </div>
  );
}
