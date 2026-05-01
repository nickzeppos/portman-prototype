import { Suspense } from 'react';
import scores113 from '@/data/scores-113.json';
import scores114 from '@/data/scores-114.json';
import scores115 from '@/data/scores-115.json';
import scores116 from '@/data/scores-116.json';
import scores117 from '@/data/scores-117.json';
import scores118 from '@/data/scores-118.json';
import { ScoresFileSchema } from '@/lib/schemas/legislator';
import { buildLegislatorRows } from '@/lib/scores';
import {
  LegislatorDetail,
  type LegislatorMembership,
  type ChamberMember,
} from '@/components/legislator-detail';

const CONGRESS_FILES = [
  { congress: 118, file: ScoresFileSchema.parse(scores118) },
  { congress: 117, file: ScoresFileSchema.parse(scores117) },
  { congress: 116, file: ScoresFileSchema.parse(scores116) },
  { congress: 115, file: ScoresFileSchema.parse(scores115) },
  { congress: 114, file: ScoresFileSchema.parse(scores114) },
  { congress: 113, file: ScoresFileSchema.parse(scores113) },
] as const;

const CONGRESS_DATA = CONGRESS_FILES.map(({ congress, file }) => ({
  congress,
  rows: buildLegislatorRows(file),
  legislators: file.legislators,
}));

export async function generateStaticParams() {
  const bioguides = new Set<string>();
  for (const { legislators } of CONGRESS_DATA) {
    for (const l of legislators) bioguides.add(l.bioguide);
  }
  return [...bioguides].map((bioguide) => ({ bioguide }));
}

export const dynamicParams = false;

export default async function LegislatorPage({
  params,
}: {
  params: Promise<{ bioguide: string }>;
}) {
  const { bioguide } = await params;

  const memberships: LegislatorMembership[] = [];
  for (const { congress, rows, legislators } of CONGRESS_DATA) {
    const row = rows.find((r) => r.bioguide === bioguide);
    const legislator = legislators.find((l) => l.bioguide === bioguide);
    if (!row || !legislator) continue;

    const chamberMembers: ChamberMember[] = rows
      .filter((r) => r.chamber === row.chamber)
      .map((r) => {
        const l = legislators.find((x) => x.bioguide === r.bioguide);
        return { ...r, issueScores: l?.issueScores ?? {} };
      });

    memberships.push({
      congress,
      row,
      issueScores: legislator.issueScores,
      chamberMembers,
    });
  }

  return (
    <Suspense fallback={null}>
      <LegislatorDetail memberships={memberships} />
    </Suspense>
  );
}
