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
  attractRankParty: number | null;
  offerRankParty: number | null;
  mostBipartisanIssue: string | null;
  billsSponsored: number | null;
  billsCosponsored: number | null;
  outPartyCosponsored: number | null;
};

// Independents in our dataset (Sanders, King) caucus with the Democrats, so
// we pool them into 'D' for any "same-party" comparison. If/when an
// independent appears who doesn't caucus with either major party, this
// alias should become explicit per legislator.
export function effectiveParty(p: string): string {
  return p === 'I' ? 'D' : p;
}

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

// Same as rankWithinChamber, but the comparison pool is further restricted
// to legislators of the same effective party. Used by the legislator detail
// page when the user toggles the comparison basis to "same party."
function rankWithinChamberParty(
  legislators: Legislator[],
  pick: (l: Legislator) => number | null,
): Map<string, number> {
  const ranks = new Map<string, number>();
  const groups = new Map<string, Legislator[]>();
  for (const l of legislators) {
    if (pick(l) === null) continue;
    const key = `${l.chamber}|${effectiveParty(l.party)}`;
    let bucket = groups.get(key);
    if (!bucket) {
      bucket = [];
      groups.set(key, bucket);
    }
    bucket.push(l);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => (pick(b) as number) - (pick(a) as number));
    list.forEach((l, i) => ranks.set(l.bioguide, i + 1));
  }
  return ranks;
}

export function buildLegislatorRows(data: ScoresFile): LegislatorRow[] {
  const attractRanks = rankWithinChamber(
    data.legislators,
    (l) => l.attractScore,
  );
  const offerRanks = rankWithinChamber(data.legislators, (l) => l.offerScore);
  const attractRanksParty = rankWithinChamberParty(
    data.legislators,
    (l) => l.attractScore,
  );
  const offerRanksParty = rankWithinChamberParty(
    data.legislators,
    (l) => l.offerScore,
  );

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
    attractRankParty: attractRanksParty.get(l.bioguide) ?? null,
    offerRankParty: offerRanksParty.get(l.bioguide) ?? null,
    mostBipartisanIssue: computeMostBipartisanIssue(l),
    billsSponsored: l.billsSponsored,
    billsCosponsored: l.billsCosponsored,
    outPartyCosponsored: l.outPartyCosponsored,
  }));
}
