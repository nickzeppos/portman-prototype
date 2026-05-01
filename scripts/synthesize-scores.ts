import { faker } from '@faker-js/faker';
import { writeFile, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  VisTableResponseSchema,
  type VisTableRow,
} from '../lib/schemas/vis-table.js';
import {
  IssueScoresSchema,
  LegislatorSchema,
  ScoresFileSchema,
  type Chamber,
  type IssueScores,
  type Legislator,
} from '../lib/schemas/legislator.js';

const CONGRESSES = [113, 114, 115, 116, 117, 118] as const;
const SEED = 20260430;

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '..', 'data');

faker.seed(SEED);

function uniform(): number {
  return faker.number.float({ min: 0, max: 1 });
}

function randn(): number {
  // Box–Muller. Skip exact zeros so log(0) doesn't blow up.
  let u = 0;
  let v = 0;
  while (u === 0) u = uniform();
  while (v === 0) v = uniform();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function round3(x: number): number {
  return Math.round(x * 1000) / 1000;
}

// CEL's Below/Meets/Exceeds rule, ported from cel-vis/src/lib/expectations.ts.
// Used as a benchmark-normalized input so majority-party LES inflation doesn't
// leak into the synthesized bipartisanship distribution.
type Expectation = 'BELOW' | 'MEETS' | 'EXCEEDS';

function getExpectation(
  score: number | null | undefined,
  benchmark: number | null | undefined,
): Expectation {
  if (benchmark == null || score == null) return 'MEETS';
  if (score < benchmark * 0.5) return 'BELOW';
  if (score <= benchmark * 1.5) return 'MEETS';
  return 'EXCEEDS';
}

// Tertile z-score cutoffs of a standard normal. BME selects which third of
// the conditional distribution y|x a legislator's offer is drawn from, given
// their attract.
const Z_BANDS: Record<Expectation, readonly [number, number]> = {
  BELOW: [-Infinity, -0.43],
  MEETS: [-0.43, 0.43],
  EXCEEDS: [0.43, Infinity],
};

// Sample (attract, offer) for a legislator/issue in a given BME tier.
// x ~ Uniform[0, 0.8]; y | x ~ N(mu(x), sigma(x)) with mu and sigma both
// increasing in x (heteroscedastic — points fan out at higher attract,
// matching the deck). Reject-resample on z out-of-band or y out-of-[0,1] so
// the floor/ceiling don't pile up.
function samplePoint(band: Expectation): { attract: number; offer: number } {
  const [lo, hi] = Z_BANDS[band];
  while (true) {
    const x = uniform() * 0.8;
    const mu = 0.05 + 0.8 * x;
    const sigma = 0.05 + 0.25 * x;
    const z = randn();
    const y = mu + sigma * z;
    if (z >= lo && z < hi && y >= 0 && y <= 1) {
      return { attract: round3(x), offer: round3(y) };
    }
  }
}

function normalizeChamber(c: string): Chamber {
  if (c === 'H') return 'house';
  if (c === 'S') return 'senate';
  throw new Error(`Unexpected chamber value: ${JSON.stringify(c)}`);
}

// Synthetic sponsorship counts. Driven by LES so they stay coherent with the
// scores (both flow from the same underlying signal):
//   - billsSponsored scales with les/benchmark (effective lawmakers introduce
//     more bills that find a cosponsor).
//   - billsCosponsored is mostly chamber-baseline activity, with a small lift
//     from LES.
//   - outPartyCosponsored is a fraction of billsCosponsored that grows with
//     attractScore — bipartisan attractors reach across the aisle more.
// Senate baselines run higher than House to reflect smaller chamber size and
// longer terms.
function sampleSponsorshipCounts(
  chamber: Chamber,
  les: number | null | undefined,
  benchmark: number | null | undefined,
  attractScore: number,
): {
  billsSponsored: number;
  billsCosponsored: number;
  outPartyCosponsored: number;
} {
  const ratio =
    les != null && benchmark != null && benchmark > 0 ? les / benchmark : 1;
  // Clamp the effectiveness ratio so freakishly high LES outliers don't
  // generate four-digit sponsor counts.
  const r = Math.max(0.1, Math.min(4, ratio));

  const isSenate = chamber === 'senate';
  const sponsorBase = isSenate ? 15 : 8;
  const cosponsorMean = isSenate ? 280 : 180;
  const cosponsorSd = isSenate ? 100 : 80;

  const billsSponsored = Math.max(
    0,
    Math.round(sponsorBase * Math.sqrt(r) * (0.5 + uniform())),
  );

  const billsCosponsored = Math.max(
    1,
    Math.round(cosponsorMean + cosponsorSd * randn() + 30 * (r - 1)),
  );

  const fraction = Math.max(
    0,
    Math.min(1, 0.05 + 0.45 * attractScore + 0.05 * randn()),
  );
  const outPartyCosponsored = Math.max(
    0,
    Math.min(billsCosponsored, Math.round(billsCosponsored * fraction)),
  );

  return { billsSponsored, billsCosponsored, outPartyCosponsored };
}

// Hamilton's largest-remainder apportionment. Floor each cell, then hand the
// integer residual to the cells with the largest fractional parts. Used to
// split a legislator-level count across issues by `iles` weight while
// guaranteeing the per-issue series sums exactly to the total.
function apportion(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum === 0 || total === 0) return weights.map(() => 0);
  const exact = weights.map((w) => (total * w) / sum);
  const out = exact.map((x) => Math.floor(x));
  let residual = total - out.reduce((a, b) => a + b, 0);
  const order = exact
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .sort((a, b) => b.frac - a.frac);
  for (let k = 0; k < residual; k++) out[order[k].i]++;
  return out;
}

// Same idea, but each cell is capped (per-issue out-party can't exceed
// per-issue cosponsored). `total` is guaranteed ≤ sum(caps) by construction
// of the legislator-level counts (outPartyCosponsored ≤ billsCosponsored).
function apportionWithCap(total: number, caps: number[]): number[] {
  const capSum = caps.reduce((a, b) => a + b, 0);
  if (capSum === 0 || total === 0) return caps.map(() => 0);
  const exact = caps.map((c) => (total * c) / capSum);
  const out = exact.map((x) => Math.floor(x));
  let residual = total - out.reduce((a, b) => a + b, 0);
  const order = exact
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .sort((a, b) => b.frac - a.frac);
  for (let k = 0; k < order.length && residual > 0; k++) {
    const i = order[k].i;
    if (out[i] < caps[i]) {
      out[i]++;
      residual--;
    }
  }
  // Tie cases or all-equal weights can leave residual after the ranked pass;
  // give it to any cell with capacity. Terminates because total ≤ sum(caps).
  while (residual > 0) {
    let progressed = false;
    for (let i = 0; i < out.length && residual > 0; i++) {
      if (out[i] < caps[i]) {
        out[i]++;
        residual--;
        progressed = true;
      }
    }
    if (!progressed) break;
  }
  return out;
}

function synthesizeRow(row: VisTableRow): Legislator {
  const expectation = getExpectation(row.les, row.benchmark);

  const overall = samplePoint(expectation);

  const issueScores: IssueScores = {};
  const issueKeys: string[] = [];
  const issueWeights: number[] = [];
  if (row.iles) {
    for (const [issue, value] of Object.entries(row.iles)) {
      // CEL's iles uses 0 to mean "no effective bills here," not "missing."
      // Skip zeros so the synthesized data preserves the source's per-issue
      // sparsity pattern.
      if (value == null || value === 0) continue;
      issueScores[issue] = samplePoint(expectation);
      issueKeys.push(issue);
      issueWeights.push(value);
    }
  }

  const chamber = normalizeChamber(row.chamber);
  const hadLes = row.les != null;

  const counts = hadLes
    ? sampleSponsorshipCounts(chamber, row.les, row.benchmark, overall.attract)
    : null;

  // Allocate the legislator-level counts across issues by iles weight, so the
  // per-issue series sums exactly to the legislator total. Out-party uses the
  // per-issue cosponsored allocation as its cap (and apportionment weight).
  if (counts && issueKeys.length > 0) {
    const sponsoredAlloc = apportion(counts.billsSponsored, issueWeights);
    const cosponsoredAlloc = apportion(counts.billsCosponsored, issueWeights);
    const outPartyAlloc = apportionWithCap(
      counts.outPartyCosponsored,
      cosponsoredAlloc,
    );
    for (let i = 0; i < issueKeys.length; i++) {
      const key = issueKeys[i];
      issueScores[key] = {
        ...issueScores[key],
        billsSponsored: sponsoredAlloc[i],
        billsCosponsored: cosponsoredAlloc[i],
        outPartyCosponsored: outPartyAlloc[i],
      };
    }
  }

  IssueScoresSchema.parse(issueScores);

  return LegislatorSchema.parse({
    congress: row.congress,
    chamber,
    state: row.state,
    bioguide: row.bioguide,
    name: row.name,
    party: row.party,
    district: row.district,
    attractScore: hadLes ? overall.attract : null,
    offerScore: hadLes ? overall.offer : null,
    billsSponsored: counts?.billsSponsored ?? null,
    billsCosponsored: counts?.billsCosponsored ?? null,
    outPartyCosponsored: counts?.outPartyCosponsored ?? null,
    issueScores,
  });
}

async function synthesizeOne(congress: number): Promise<void> {
  const rawPath = resolve(DATA_DIR, `roster-${congress}.raw.json`);
  const raw: unknown = JSON.parse(await readFile(rawPath, 'utf8'));
  const response = VisTableResponseSchema.parse(raw);

  const legislators = response.data.map(synthesizeRow);
  const file = ScoresFileSchema.parse({ congress, legislators });

  const outPath = resolve(DATA_DIR, `scores-${congress}.json`);
  await writeFile(outPath, JSON.stringify(file, null, 2) + '\n', 'utf8');

  const tiers = { BELOW: 0, MEETS: 0, EXCEEDS: 0 };
  let emptyIssues = 0;
  for (const r of response.data) {
    tiers[getExpectation(r.les, r.benchmark)]++;
  }
  for (const l of legislators) {
    if (Object.keys(l.issueScores).length === 0) emptyIssues++;
  }
  console.log(
    `Wrote ${outPath}: ${legislators.length} legislators ` +
      `[BELOW ${tiers.BELOW} / MEETS ${tiers.MEETS} / EXCEEDS ${tiers.EXCEEDS}], ` +
      `${emptyIssues} with empty issueScores`,
  );
}

async function main(): Promise<void> {
  for (const c of CONGRESSES) {
    await synthesizeOne(c);
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
