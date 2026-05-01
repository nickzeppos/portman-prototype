import { Jost } from 'next/font/google';

const jost = Jost({ subsets: ['latin'], weight: ['500', '600', '700'] });

export function ComingSoon({ title }: { title: string }) {
  return (
    <main className="mx-auto max-w-7xl p-6">
      <h1
        className={`${jost.className} text-3xl font-bold uppercase tracking-wider text-gray-900`}
      >
        {title}
      </h1>
      <p className="mt-2 text-sm text-gray-500">Coming soon.</p>
    </main>
  );
}
