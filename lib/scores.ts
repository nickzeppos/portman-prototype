import type { Chamber, Legislator, ScoresFile } from './schemas/legislator';
import { getIssueDisplayName } from './issues';

export type LegislatorRow = {
  bioguide: string;
  name: string;
  chamber: Chamber;
  state: string;
  district: number | null;
  party: string;
  attractScore: number | null;
  offerScore: number | null;
  attractRank: number | null;
  offerRank: number | null;
  mostBipartisanIssue: string | null;
  billsSponsored: number | null;
  billsCosponsored: number | null;
  outPartyCosponsored: number | null;
};

function computeMostBipartisanIssue(l: Legislator): string | null {
  const entries = Object.entries(l.issueScores);
  if (entries.length === 0) return null;
  let bestSlug = entries[0][0];
  let bestSum = entries[0][1].attract + entries[0][1].offer;
  for (let i = 1; i < entries.length; i++) {
    const [slug, { attract, offer }] = entries[i];
    const sum = attract + offer;
    if (sum > bestSum) {
      bestSlug = slug;
      bestSum = sum;
    }
  }
  return getIssueDisplayName(bestSlug);
}

// Ranks are computed within (chamber) — comparing a senator's score to a
// representative's directly is not meaningful. Legislators with null scores
// receive null ranks.
function rankWithinChamber(
  legislators: Legislator[],
  pick: (l: Legislator) => number | null,
): Map<string, number> {
  const ranks = new Map<string, number>();
  for (const chamber of ['house', 'senate'] as const) {
    const rankable = legislators
      .filter((l) => l.chamber === chamber && pick(l) !== null)
      .sort((a, b) => (pick(b) as number) - (pick(a) as number));
    rankable.forEach((l, i) => ranks.set(l.bioguide, i + 1));
  }
  return ranks;
}

export function buildLegislatorRows(data: ScoresFile): LegislatorRow[] {
  const attractRanks = rankWithinChamber(
    data.legislators,
    (l) => l.attractScore,
  );
  const offerRanks = rankWithinChamber(data.legislators, (l) => l.offerScore);

  return data.legislators.map((l) => ({
    bioguide: l.bioguide,
    name: l.name,
    chamber: l.chamber,
    state: l.state,
    district: l.district,
    party: l.party,
    attractScore: l.attractScore,
    offerScore: l.offerScore,
    attractRank: attractRanks.get(l.bioguide) ?? null,
    offerRank: offerRanks.get(l.bioguide) ?? null,
    mostBipartisanIssue: computeMostBipartisanIssue(l),
    billsSponsored: l.billsSponsored,
    billsCosponsored: l.billsCosponsored,
    outPartyCosponsored: l.outPartyCosponsored,
  }));
}
