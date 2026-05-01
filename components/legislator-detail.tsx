'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Jost } from 'next/font/google';
import type { IssueScores } from '@/lib/schemas/legislator';
import type { LegislatorRow } from '@/lib/scores';
import { getIssueDisplayName } from '@/lib/issues';
import { ordinal } from '@/lib/format';
import { BipartisanshipScatter } from './bipartisanship-scatter';
import { CareerSparkline, CareerSparklineLegend } from './career-sparkline';
import { CongressDropdown } from './congress-dropdown';
import { IssueDropdown } from './issue-dropdown';

const jost = Jost({ subsets: ['latin'], weight: ['500', '600', '700'] });

export type ChamberMember = LegislatorRow & { issueScores: IssueScores };

export type LegislatorMembership = {
  congress: number;
  row: LegislatorRow;
  issueScores: IssueScores;
  chamberMembers: ChamberMember[];
};

const PARTY_COLORS: Record<string, string> = {
  D: 'text-blue-700',
  R: 'text-red-700',
  I: 'text-gray-700',
};

const KNOWN_PARTIES = ['D', 'R', 'I'] as const;

// Counts of legislators by party in the rows currently rendered in the
// chart. Mirrors the explorer's PartyCounts so the breadcrumb conveys at a
// glance how many of each party are visible after filtering by issue.
function PartyCounts({ rows }: { rows: LegislatorRow[] }) {
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.party, (counts.get(r.party) ?? 0) + 1);
  const order = [
    ...KNOWN_PARTIES,
    ...[...counts.keys()].filter(
      (p) => !KNOWN_PARTIES.includes(p as (typeof KNOWN_PARTIES)[number]),
    ),
  ];
  return (
    <span className="flex gap-3 text-sm">
      {order
        .filter((p) => (counts.get(p) ?? 0) > 0)
        .map((p) => (
          <span
            key={p}
            className={`font-semibold ${PARTY_COLORS[p] ?? 'text-gray-700'}`}
          >
            {counts.get(p)} {p}
          </span>
        ))}
    </span>
  );
}

// Pre-rotation dimensions of the career sparkline. After CW rotation the
// visual occupies SPARK_H wide × SPARK_W tall. Sized to leave room in the
// right column for the legend (with both pl-4 and pr-4 buffers and a
// gap-3 between them).
const SPARK_W = 270;
const SPARK_H = 280;

function fmtScore(s: number | null): string {
  return s == null ? '—' : s.toFixed(3);
}
function fmtRank(r: number | null): string {
  return r == null ? '—' : String(r);
}
function fmtCount(v: number | null): string {
  return v == null ? '—' : v.toLocaleString();
}

// Shared section-title style. Used by both the metrics card's section
// headers and the career-trajectory title in the right column so they
// stay visually unified.
const SECTION_LABEL_CLASS = `${jost.className} text-xs font-bold uppercase tracking-wider text-gray-500`;

function MetricsCard({
  attract,
  attractRank,
  offer,
  offerRank,
  billsSponsored,
  billsCosponsored,
  outPartyCosponsored,
  issueLabel,
}: {
  attract: number | null;
  attractRank: number | null;
  offer: number | null;
  offerRank: number | null;
  billsSponsored: number | null;
  billsCosponsored: number | null;
  outPartyCosponsored: number | null;
  issueLabel: string;
}) {
  const labelClass = SECTION_LABEL_CLASS;
  const headerClass = `${jost.className} text-[10px] font-bold uppercase tracking-wider text-gray-400`;
  const numClass = 'text-right font-mono font-bold text-gray-900';

  return (
    <div>
      {/* Bipartisanship Metrics: title, then sub-header row + two data rows */}
      <div>
        <span className={labelClass}>Bipartisanship Metrics · {issueLabel}</span>
        <div className="mt-3 grid grid-cols-[1fr_auto_auto] items-baseline gap-x-3">
          <span />
          <span className={`${headerClass} text-right`}>Score</span>
          <span className={`${headerClass} text-right`}>Rank</span>

          <span className={labelClass}>Attract</span>
          <span className={numClass}>{fmtScore(attract)}</span>
          <span className={numClass}>{fmtRank(attractRank)}</span>

          <span className={labelClass}>Offer</span>
          <span className={numClass}>{fmtScore(offer)}</span>
          <span className={numClass}>{fmtRank(offerRank)}</span>
        </div>
      </div>

      {/* Score components: sub-header row + three data rows */}
      <div className="mt-6">
        <div className="grid grid-cols-[1fr_auto] items-baseline gap-x-3">
          <span />
          <span className={`${headerClass} text-right`}>Counts</span>

          <span className={labelClass}>Bills Sponsored</span>
          <span className={numClass}>{fmtCount(billsSponsored)}</span>

          <span className={labelClass}>Bills Cosponsored</span>
          <span className={numClass}>{fmtCount(billsCosponsored)}</span>

          <span className={labelClass}>Out-Party Bills Cosponsored</span>
          <span className={numClass}>{fmtCount(outPartyCosponsored)}</span>
        </div>
      </div>
    </div>
  );
}

export function LegislatorDetail({
  memberships,
}: {
  memberships: LegislatorMembership[];
}) {
  const sorted = [...memberships].sort((a, b) => b.congress - a.congress);
  // Default congress = most recent membership; matches the value omitted
  // from shareable URLs.
  const defaultCongress = sorted[0].congress;
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [congress, setCongress] = useState<number>(() => {
    const c = parseInt(searchParams.get('congress') ?? '', 10);
    return sorted.some((m) => m.congress === c) ? c : defaultCongress;
  });
  const [issue, setIssue] = useState<string | null>(
    () => searchParams.get('issue') || null,
  );

  // Toggling congress always resets the issue selector — different congresses
  // expose different issues for the same legislator, and silently carrying a
  // selection across them gives surprising empty cards/charts.
  const handleCongressChange = (c: number) => {
    setCongress(c);
    setIssue(null);
  };
  const current = sorted.find((m) => m.congress === congress) ?? sorted[0];
  const { row, issueScores, chamberMembers } = current;

  // If a URL-provided issue isn't valid for the current congress's roster,
  // silently drop it.
  useEffect(() => {
    if (issue !== null && !(issue in issueScores)) {
      setIssue(null);
    }
  }, [issue, issueScores]);

  // Mirror selection state to the URL (replace, no history entry). Defaults
  // are omitted; the bioguide stays in the path so cross-bio nav (which
  // doesn't carry these query params) naturally drops them.
  useEffect(() => {
    const params = new URLSearchParams();
    if (congress !== defaultCongress) params.set('congress', String(congress));
    if (issue !== null) params.set('issue', issue);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [congress, issue, defaultCongress, pathname, router]);

  // When an issue is selected, scores, ranks, and sponsorship counts all
  // come from per-issue data. Otherwise the row's overall values are used.
  const {
    displayedAttract,
    displayedOffer,
    displayedAttractRank,
    displayedOfferRank,
    displayedBillsSponsored,
    displayedBillsCosponsored,
    displayedOutPartyCosponsored,
  } = useMemo(() => {
    if (issue === null) {
      return {
        displayedAttract: row.attractScore,
        displayedOffer: row.offerScore,
        displayedAttractRank: row.attractRank,
        displayedOfferRank: row.offerRank,
        displayedBillsSponsored: row.billsSponsored,
        displayedBillsCosponsored: row.billsCosponsored,
        displayedOutPartyCosponsored: row.outPartyCosponsored,
      };
    }
    const mine = issueScores[issue];
    const withIssue = chamberMembers.filter(
      (m) => m.issueScores[issue] !== undefined,
    );
    const attractRank =
      mine == null
        ? null
        : 1 +
          withIssue
            .slice()
            .sort(
              (a, b) =>
                (b.issueScores[issue]?.attract ?? 0) -
                (a.issueScores[issue]?.attract ?? 0),
            )
            .findIndex((m) => m.bioguide === row.bioguide);
    const offerRank =
      mine == null
        ? null
        : 1 +
          withIssue
            .slice()
            .sort(
              (a, b) =>
                (b.issueScores[issue]?.offer ?? 0) -
                (a.issueScores[issue]?.offer ?? 0),
            )
            .findIndex((m) => m.bioguide === row.bioguide);
    return {
      displayedAttract: mine?.attract ?? null,
      displayedOffer: mine?.offer ?? null,
      displayedAttractRank: attractRank,
      displayedOfferRank: offerRank,
      displayedBillsSponsored: mine?.billsSponsored ?? null,
      displayedBillsCosponsored: mine?.billsCosponsored ?? null,
      displayedOutPartyCosponsored: mine?.outPartyCosponsored ?? null,
    };
  }, [issue, issueScores, chamberMembers, row]);

  // Chart rows: when an issue is selected, project each member's
  // (attract, offer) onto that issue's scores and drop members who weren't
  // active in it.
  const chartRows = useMemo<LegislatorRow[]>(() => {
    if (issue === null) {
      return chamberMembers;
    }
    return chamberMembers
      .filter((m) => m.issueScores[issue] !== undefined)
      .map((m) => {
        const s = m.issueScores[issue];
        return {
          ...m,
          attractScore: s.attract,
          offerScore: s.offer,
          attractRank: null,
          offerRank: null,
          mostBipartisanIssue: null,
        };
      });
  }, [chamberMembers, issue]);

  const availableIssues = useMemo(
    () =>
      Object.keys(issueScores).sort((a, b) =>
        getIssueDisplayName(a).localeCompare(getIssueDisplayName(b)),
      ),
    [issueScores],
  );

  const chamberLabel = row.chamber === 'house' ? 'House' : 'Senate';
  const issueLabel = issue === null ? 'All Issues' : getIssueDisplayName(issue);
  const chartTitle = `${issueLabel} — Bipartisanship Among ${chamberLabel} Members in the ${ordinal(congress)} Congress`;

  const highlighted = useMemo(
    () => (r: LegislatorRow) => r.bioguide === row.bioguide,
    [row.bioguide],
  );

  return (
    <main className="mx-auto max-w-5xl p-6">
      {/* Narrow header block — link, name, identity, breadcrumb, chart. The
          wrapper centers this block within the wider main; the chart's
          align="left" then keeps everything inside flush-left. */}
      <div className="mx-auto max-w-3xl">
        <Link href="/scores" className="text-sm text-brand hover:underline">
          ← All legislators
        </Link>

        <h1
          className={`${jost.className} mt-4 text-3xl font-bold uppercase tracking-wider text-gray-900`}
        >
          {row.name}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-600">
          <span
            className={`font-semibold ${PARTY_COLORS[row.party] ?? 'text-gray-700'}`}
          >
            {row.party}
          </span>
          <span className="text-gray-400">·</span>
          <span>
            {row.state}
            {row.district !== null && `-${row.district}`}
          </span>
          <span className="text-gray-400">·</span>
          <span>{chamberLabel}</span>
        </div>

        <nav className="mt-6 flex flex-wrap items-center gap-2 text-base text-gray-600">
          {sorted.length > 1 ? (
            <CongressDropdown
              value={congress}
              options={sorted.map((m) => m.congress)}
              onChange={handleCongressChange}
            />
          ) : (
            <span>{ordinal(sorted[0].congress)} Congress</span>
          )}
          <span className="text-gray-400">»</span>
          <IssueDropdown
            value={issue}
            options={availableIssues}
            onChange={setIssue}
          />
          <span className="text-gray-400">»</span>
          <PartyCounts rows={chartRows} />
        </nav>

        <section className="mt-4">
          <BipartisanshipScatter
            rows={chartRows}
            highlighted={highlighted}
            title={chartTitle}
            maxWidth={696}
            align="left"
          />
        </section>
      </div>

      <section className="mt-6 grid grid-cols-2 gap-4">
        <MetricsCard
          attract={displayedAttract}
          attractRank={displayedAttractRank}
          offer={displayedOffer}
          offerRank={displayedOfferRank}
          billsSponsored={displayedBillsSponsored}
          billsCosponsored={displayedBillsCosponsored}
          outPartyCosponsored={displayedOutPartyCosponsored}
          issueLabel={issueLabel}
        />
        {/*
          Rotate the CareerSparkline 90° clockwise so the left-to-right time
          axis becomes top-to-bottom (earliest at top). The sparkline's
          natural box here is SPARK_W × SPARK_H; after CW rotation it
          occupies a SPARK_H × SPARK_W column. The legend is rendered above
          the rotated chart in normal page orientation.
        */}
        <div className="px-4">
          <span className={SECTION_LABEL_CLASS}>Career Trajectory · All Issues</span>
          {/* items-center vertically centers the legend on the row, which
              has the height of the (taller) sparkline wrapper. The selected-
              congress band is itself vertically centered in the rotated
              wrapper, so the two end up horizontally aligned. */}
          <div className="mt-3 flex items-center gap-3">
            <div
              className="relative"
              style={{ width: SPARK_H, height: SPARK_W }}
            >
              <div
                className="absolute left-0 top-0"
                style={{
                  width: SPARK_W,
                  height: SPARK_H,
                  transform: `translate(${SPARK_H}px, 0) rotate(90deg)`,
                  transformOrigin: '0 0',
                }}
              >
                <CareerSparkline
                  memberships={sorted}
                  currentCongress={congress}
                  onCongressChange={handleCongressChange}
                  width={SPARK_W}
                  height={SPARK_H}
                  vertical
                />
              </div>
            </div>
            <CareerSparklineLegend
              memberships={sorted}
              currentCongress={congress}
            />
          </div>
        </div>
      </section>
    </main>
  );
}

