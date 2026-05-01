import { Suspense } from 'react';
import { Jost } from 'next/font/google';
import scores113 from '@/data/scores-113.json';
import scores114 from '@/data/scores-114.json';
import scores115 from '@/data/scores-115.json';
import scores116 from '@/data/scores-116.json';
import scores117 from '@/data/scores-117.json';
import scores118 from '@/data/scores-118.json';
import { ScoresFileSchema } from '@/lib/schemas/legislator';
import { buildLegislatorRows } from '@/lib/scores';
import {
  LegislatorExplorer,
  type CongressData,
} from '@/components/legislator-explorer';

const jost = Jost({ subsets: ['latin'], weight: ['500', '600', '700'] });

const congresses: CongressData[] = [
  { congress: 118, rows: buildLegislatorRows(ScoresFileSchema.parse(scores118)) },
  { congress: 117, rows: buildLegislatorRows(ScoresFileSchema.parse(scores117)) },
  { congress: 116, rows: buildLegislatorRows(ScoresFileSchema.parse(scores116)) },
  { congress: 115, rows: buildLegislatorRows(ScoresFileSchema.parse(scores115)) },
  { congress: 114, rows: buildLegislatorRows(ScoresFileSchema.parse(scores114)) },
  { congress: 113, rows: buildLegislatorRows(ScoresFileSchema.parse(scores113)) },
];

export default function HomePage() {
  return (
    <main className="mx-auto max-w-7xl p-6">
      <h1
        className={`${jost.className} mb-4 text-3xl font-bold uppercase tracking-wider text-gray-900`}
      >
        Bipartisanship Scores
      </h1>
      <Suspense fallback={null}>
        <LegislatorExplorer congresses={congresses} />
      </Suspense>
    </main>
  );
}
