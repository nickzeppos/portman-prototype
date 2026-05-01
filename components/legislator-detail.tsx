'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Jost } from 'next/font/google';
import type { IssueScores } from '@/lib/schemas/legislator';
import { effectiveParty, type LegislatorRow } from '@/lib/scores';
import { getIssueDisplayName } from '@/lib/issues';
import { ordinal } from '@/lib/format';
import { BipartisanshipScatter } from './bipartisanship-scatter';
import { CareerSparkline, CareerSparklineLegend } from './career-sparkline';
import { CongressDropdown } from './congress-dropdown';
import { IssueDropdown } from './issue-dropdown';
import { BasisDropdown, type Basis } from './basis-dropdown';

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
  basisLabel,
}: {
  attract: number | null;
  attractRank: number | null;
  offer: number | null;
  offerRank: number | null;
  billsSponsored: number | null;
  billsCosponsored: number | null;
  outPartyCosponsored: number | null;
  issueLabel: string;
  basisLabel: string;
}) {
  const labelClass = SECTION_LABEL_CLASS;
  const headerClass = `${jost.className} text-[10px] font-bold uppercase tracking-wider text-gray-400`;
  const numClass = 'text-right font-mono font-bold text-gray-900';

  return (
    <div>
      {/* Bipartisanship Metrics: title, then sub-header row + two data rows */}
      <div>
        <span className={labelClass}>
          <span className="text-brand">Bipartisanship Metrics</span>
          <span className="font-normal"> · {basisLabel} · {issueLabel}</span>
        </span>
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
  const [basis, setBasis] = useState<Basis>(
    () => (searchParams.get('basis') === 'party' ? 'party' : 'chamber'),
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
    if (basis !== 'chamber') params.set('basis', basis);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [congress, issue, basis, defaultCongress, pathname, router]);

  // When an issue is selected, scores, ranks, and sponsorship counts all
  // come from per-issue data. Otherwise the row's overall values are used.
  // Ranks vary by basis: chamber-wide use precomputed columns; same-party
  // use the precomputed party columns when no issue is selected, or a
  // filtered re-sort when one is.
  const {
    displayedAttract,
    displayedOffer,
    displayedAttractRank,
    displayedOfferRank,
    displayedBillsSponsored,
    displayedBillsCosponsored,
    displayedOutPartyCosponsored,
  } = useMemo(() => {
    const myParty = effectiveParty(row.party);
    if (issue === null) {
      return {
        displayedAttract: row.attractScore,
        displayedOffer: row.offerScore,
        displayedAttractRank:
          basis === 'chamber' ? row.attractRank : row.attractRankParty,
        displayedOfferRank:
          basis === 'chamber' ? row.offerRank : row.offerRankParty,
        displayedBillsSponsored: row.billsSponsored,
        displayedBillsCosponsored: row.billsCosponsored,
        displayedOutPartyCosponsored: row.outPartyCosponsored,
      };
    }
    const mine = issueScores[issue];
    const withIssue = chamberMembers
      .filter((m) => m.issueScores[issue] !== undefined)
      .filter(
        (m) => basis === 'chamber' || effectiveParty(m.party) === myParty,
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
  }, [issue, issueScores, chamberMembers, row, basis]);

  // Chart rows: when an issue is selected, project each member's
  // (attract, offer) onto that issue's scores and drop members who weren't
  // active in it. Under the same-party basis, also drop out-of-party
  // members so the chart matches the comparison pool used for ranking.
  const chartRows = useMemo<LegislatorRow[]>(() => {
    const myParty = effectiveParty(row.party);
    const partyFilter = (m: ChamberMember) =>
      basis === 'chamber' || effectiveParty(m.party) === myParty;
    if (issue === null) {
      return chamberMembers.filter(partyFilter);
    }
    return chamberMembers
      .filter((m) => m.issueScores[issue] !== undefined)
      .filter(partyFilter)
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
  }, [chamberMembers, issue, basis, row.party]);

  const availableIssues = useMemo(
    () =>
      Object.keys(issueScores).sort((a, b) =>
        getIssueDisplayName(a).localeCompare(getIssueDisplayName(b)),
      ),
    [issueScores],
  );

  const chamberLabel = row.chamber === 'house' ? 'House' : 'Senate';
  const partyAdjective: Record<string, string> = {
    D: 'Democratic',
    R: 'Republican',
  };
  const partyAdj = partyAdjective[effectiveParty(row.party)] ?? '';
  const issueLabel = issue === null ? 'All Issues' : getIssueDisplayName(issue);
  const basisLabel = basis === 'chamber' ? 'By Chamber' : 'By Party';
  const compareLabel =
    basis === 'chamber'
      ? `${chamberLabel} Members`
      : `${partyAdj} ${chamberLabel} Members`;
  const chartTitle = `${issueLabel} — Bipartisanship Among ${compareLabel} in the ${ordinal(congress)} Congress`;

  const highlighted = useMemo(
    () => (r: LegislatorRow) => r.bioguide === row.bioguide,
    [row.bioguide],
  );

  return (
    <main className="mx-auto max-w-5xl p-6">
      {/* Narrow content block — link, name, identity, headers, scatter.
          The wrapper centers this block within the wider main. */}
      <div className="mx-auto max-w-3xl">
        <Link href="/scores" className="text-sm text-brand hover:underline">
          ← All legislators
        </Link>

        <h1
          className={`${jost.className} mt-4 text-3xl font-bold uppercase tracking-wider text-gray-900`}
        >
          {row.name}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-600">
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
          <span className="text-gray-400">·</span>
          {sorted.length > 1 ? (
            <CongressDropdown
              value={congress}
              options={sorted.map((m) => m.congress)}
              onChange={handleCongressChange}
            />
          ) : (
            <span>{ordinal(sorted[0].congress)} Congress</span>
          )}
          <span className="text-gray-400">·</span>
          <BasisDropdown value={basis} onChange={setBasis} />
          <span className="text-gray-400">·</span>
          <IssueDropdown
            value={issue}
            options={availableIssues}
            onChange={setIssue}
          />
        </div>

        <section className="mt-6 grid grid-cols-[2fr_auto_1fr] gap-4">
          <div className="py-3">
            <MetricsCard
              attract={displayedAttract}
              attractRank={displayedAttractRank}
              offer={displayedOffer}
              offerRank={displayedOfferRank}
              billsSponsored={displayedBillsSponsored}
              billsCosponsored={displayedBillsCosponsored}
              outPartyCosponsored={displayedOutPartyCosponsored}
              issueLabel={issueLabel}
              basisLabel={basisLabel}
            />
          </div>
          {/* Faint divider centered in the doubled gutter between metrics and
              portrait. Auto-sized to its 1px width; the gap-4 on either side
              gives 1rem of whitespace per side, doubling the previous
              single-gap-4 spacing. */}
          <div className="w-px bg-gray-200" aria-hidden />
          {/* Placeholder slot for the legislator's official portrait. Stretches
              to match the metrics card's height so the row reads as a unit. */}
          <div className="flex h-full w-full items-center justify-center rounded bg-gray-100 text-xs uppercase tracking-wider text-gray-400">
            Portrait
          </div>
        </section>

        <section className="mt-6">
          <span className={SECTION_LABEL_CLASS}>
            <span className="text-brand">Career Trajectory</span>
            <span className="font-normal">
              {' · '}
              {basisLabel}
              {' · All Issues '}
              <svg
                aria-label="fixed"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="ml-0.5 inline-block h-3 w-3 align-[-0.1em] text-gray-400"
              >
                <path
                  fillRule="evenodd"
                  d="M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 8V5.5a3 3 0 1 0-6 0V9h6Z"
                  clipRule="evenodd"
                />
              </svg>
            </span>
          </span>
          <div className="mt-3 flex items-center gap-3">
            <div className="flex-1">
              <CareerSparkline
                memberships={sorted}
                currentCongress={congress}
                onCongressChange={handleCongressChange}
                basis={basis}
                height={163}
              />
            </div>
            <CareerSparklineLegend
              memberships={sorted}
              currentCongress={congress}
              basis={basis}
            />
          </div>
        </section>

        <section className="mt-6">
          <BipartisanshipScatter
            rows={chartRows}
            highlighted={highlighted}
            title={chartTitle}
            maxWidth={696}
          />
        </section>
      </div>
    </main>
  );
}

