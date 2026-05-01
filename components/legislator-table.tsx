'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import type { Chamber } from '@/lib/schemas/legislator';
import type { LegislatorRow } from '@/lib/scores';

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

// Column widths sized to fit worst-case content (longest legislator name +
// longest issue display) so toggling chamber doesn't reflow the table.
function buildColumns(chamber: Chamber): ColumnDef<LegislatorRow>[] {
  return [
    {
      accessorKey: 'name',
      header: 'Name',
      size: 240,
      cell: ({ row }) => (
        <Link
          href={`/legislator/${row.original.bioguide}`}
          className="text-gray-800 group-hover:text-brand group-hover:underline"
        >
          {row.original.name}
        </Link>
      ),
    },
    {
      accessorKey: 'party',
      header: 'Party',
      size: 80,
      cell: ({ row }) => {
        const p = row.original.party;
        return (
          <span
            className={`font-semibold ${PARTY_COLORS[p] ?? 'text-gray-700'}`}
          >
            {p}
          </span>
        );
      },
    },
    {
      accessorKey: 'state',
      header: 'State',
      size: 80,
      cell: ({ row }) => row.original.state,
    },
    {
      accessorKey: 'district',
      header: 'District',
      size: 88,
      // District is null for senators — sorting offers no signal in that view.
      enableSorting: chamber !== 'senate',
      cell: ({ row }) => row.original.district ?? '—',
    },
    {
      accessorKey: 'attractScore',
      header: 'Attract',
      size: 96,
      cell: ({ row }) => (
        <span className="font-mono">{fmtScore(row.original.attractScore)}</span>
      ),
    },
    {
      accessorKey: 'offerScore',
      header: 'Offer',
      size: 96,
      cell: ({ row }) => (
        <span className="font-mono">{fmtScore(row.original.offerScore)}</span>
      ),
    },
    {
      accessorKey: 'attractRank',
      header: 'Attract Rank',
      size: 128,
      cell: ({ row }) => (
        <span className="font-mono">{fmtRank(row.original.attractRank)}</span>
      ),
    },
    {
      accessorKey: 'offerRank',
      header: 'Offer Rank',
      size: 120,
      cell: ({ row }) => (
        <span className="font-mono">{fmtRank(row.original.offerRank)}</span>
      ),
    },
    {
      accessorKey: 'mostBipartisanIssue',
      header: 'Most Bipartisan Issue',
      size: 200,
      cell: ({ row }) => row.original.mostBipartisanIssue ?? '—',
    },
  ];
}

export function LegislatorTable({
  data,
  chamber,
}: {
  data: LegislatorRow[];
  chamber: Chamber;
}) {
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'attractScore', desc: true },
  ]);
  const columns = useMemo(() => buildColumns(chamber), [chamber]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="mx-auto w-fit max-w-full overflow-x-auto rounded border border-gray-200 bg-white shadow-sm">
      <table className="table-fixed divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => {
                const sorted = h.column.getIsSorted();
                const canSort = h.column.getCanSort();
                return (
                  <th
                    key={h.id}
                    style={{ width: h.column.getSize() }}
                    onClick={
                      canSort ? h.column.getToggleSortingHandler() : undefined
                    }
                    className={`select-none px-3 py-2 text-left font-semibold text-gray-700 ${
                      canSort ? 'cursor-pointer hover:bg-gray-100' : ''
                    }`}
                  >
                    <span className="inline-flex items-center gap-1">
                      {flexRender(h.column.columnDef.header, h.getContext())}
                      {sorted === 'asc' && '▲'}
                      {sorted === 'desc' && '▼'}
                    </span>
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody className="divide-y divide-gray-200">
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              className="group cursor-pointer hover:bg-gray-50"
              onClick={() =>
                router.push(`/legislator/${row.original.bioguide}`)
              }
            >
              {row.getVisibleCells().map((cell) => (
                <td
                  key={cell.id}
                  className="truncate px-3 py-2 text-gray-800"
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
