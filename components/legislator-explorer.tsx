'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import type { Chamber } from '@/lib/schemas/legislator';
import type { LegislatorRow } from '@/lib/scores';
import { ordinal } from '@/lib/format';
import { useDismissOnOutside } from '@/lib/use-dismiss-on-outside';
import { replaceUrl } from '@/lib/url-sync';
import { BipartisanshipScatter } from './bipartisanship-scatter';
import { CongressDropdown } from './congress-dropdown';
import { LegislatorTable } from './legislator-table';
import { SearchBox } from './search-box';

export type CongressData = { congress: number; rows: LegislatorRow[] };

const KNOWN_PARTIES = ['D', 'R', 'I'] as const;

const PARTY_COLORS: Record<string, string> = {
  D: 'text-blue-700',
  R: 'text-red-700',
  I: 'text-gray-700',
};

function StateDropdown({
  value,
  options,
  onChange,
}: {
  value: string | null;
  options: readonly string[];
  onChange: (s: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismissOnOutside(ref, open, () => setOpen(false));

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-1 hover:text-brand"
      >
        {value ?? 'All states'}
        <span className="text-xs leading-none">▾</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-10 mt-1 max-h-72 min-w-[10rem] overflow-y-auto rounded-md border border-gray-200 bg-white py-1 shadow-md"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
            className={`block w-full px-3 py-2 text-left text-sm hover:bg-brand hover:text-white ${
              value === null ? 'font-semibold text-brand' : 'text-gray-800'
            }`}
          >
            All states
          </button>
          <div className="my-1 border-t border-gray-100" />
          {options.map((s) => (
            <button
              key={s}
              type="button"
              role="menuitem"
              onClick={() => {
                onChange(s);
                setOpen(false);
              }}
              className={`block w-full px-3 py-2 text-left text-sm hover:bg-brand hover:text-white ${
                s === value ? 'font-semibold text-brand' : 'text-gray-800'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ChamberToggle({
  value,
  onChange,
}: {
  value: Chamber;
  onChange: (c: Chamber) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Chamber"
      className="inline-flex gap-0.5 rounded-md bg-gray-100 p-0.5 text-sm"
    >
      {(['house', 'senate'] as const).map((c) => {
        const active = value === c;
        return (
          <button
            key={c}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(c)}
            className={`rounded px-3 py-1 transition-colors ${
              active
                ? 'bg-brand font-semibold text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {c === 'house' ? 'House' : 'Senate'}
          </button>
        );
      })}
    </div>
  );
}

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
    <div className="flex gap-3 text-sm">
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
    </div>
  );
}

export function LegislatorExplorer({
  congresses,
}: {
  congresses: CongressData[];
}) {
  // Defaults: most-recent congress, House, no state filter. These match the
  // values we omit from shareable URLs.
  const defaultCongress = congresses[0].congress;
  const searchParams = useSearchParams();
  const pathname = usePathname();

  // Read URL params once at mount to seed state (lazy initial state). Later
  // URL updates flow from state → URL via the sync effect below; we do not
  // re-read searchParams as the source of truth, since our own writes would
  // otherwise create a feedback loop.
  const [congress, setCongress] = useState<number>(() => {
    const c = parseInt(searchParams.get('congress') ?? '', 10);
    return congresses.some((x) => x.congress === c) ? c : defaultCongress;
  });
  const [chamber, setChamber] = useState<Chamber>(() => {
    const c = searchParams.get('chamber');
    return c === 'senate' || c === 'house' ? c : 'house';
  });
  const [state, setState] = useState<string | null>(
    () => searchParams.get('state') || null,
  );
  const [searchQuery, setSearchQuery] = useState('');

  // Filtering by state can shrink the page enough that the browser clamps the
  // scroll position to the new max — which reads as a sudden jump. Smooth-
  // scrolling to the top makes the transition feel intentional.
  const handleStateChange = (s: string | null) => {
    setState(s);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const allRows = useMemo(
    () => congresses.find((c) => c.congress === congress)?.rows ?? [],
    [congresses, congress],
  );
  const stateOptions = useMemo(
    () => [...new Set(allRows.map((r) => r.state))].sort(),
    [allRows],
  );

  // If a URL-provided state isn't valid for the current congress's roster,
  // silently drop it. Runs after stateOptions is known.
  useEffect(() => {
    if (state !== null && !stateOptions.includes(state)) {
      setState(null);
    }
  }, [state, stateOptions]);

  // Mirror filter state to the URL bar so links remain shareable. Defaults
  // are omitted so the canonical URL has no params.
  useEffect(() => {
    const params = new URLSearchParams();
    if (congress !== defaultCongress) params.set('congress', String(congress));
    if (chamber !== 'house') params.set('chamber', chamber);
    if (state !== null) params.set('state', state);
    replaceUrl(pathname, params);
  }, [congress, chamber, state, defaultCongress, pathname]);
  const chamberRows = useMemo(
    () => allRows.filter((r) => r.chamber === chamber),
    [allRows, chamber],
  );
  const filtered = useMemo(() => {
    const base =
      state === null
        ? chamberRows
        : chamberRows.filter((r) => r.state === state);
    const q = searchQuery.trim().toLowerCase();
    return q ? base.filter((r) => r.name.toLowerCase().includes(q)) : base;
  }, [chamberRows, state, searchQuery]);

  const chartTitle = `Bipartisanship Among ${chamber === 'house' ? 'House' : 'Senate'} Members in the ${ordinal(congress)} Congress`;

  const highlighted = useMemo(
    () => (state === null ? null : (r: LegislatorRow) => r.state === state),
    [state],
  );

  return (
    <>
      <BipartisanshipScatter
        rows={chamberRows}
        highlighted={highlighted}
        title={chartTitle}
      />
      <div className="mx-auto w-fit max-w-full">
        <div className="mb-4 mt-1 flex items-center justify-between gap-4">
          <nav className="flex flex-wrap items-center gap-2 text-base text-gray-600">
            <CongressDropdown
              value={congress}
              options={congresses.map((c) => c.congress)}
              onChange={setCongress}
            />
            <span className="text-gray-400">»</span>
            <ChamberToggle value={chamber} onChange={setChamber} />
            <span className="text-gray-400">»</span>
            <StateDropdown
              value={state}
              options={stateOptions}
              onChange={handleStateChange}
            />
            <span className="text-gray-400">»</span>
            <PartyCounts rows={filtered} />
          </nav>
          <SearchBox value={searchQuery} onChange={setSearchQuery} />
        </div>
        <LegislatorTable data={filtered} chamber={chamber} />
      </div>
    </>
  );
}
