'use client';

import { useRef, useState } from 'react';
import { useDismissOnOutside } from '@/lib/use-dismiss-on-outside';
import { getIssueDisplayName } from '@/lib/issues';

export function IssueDropdown({
  value,
  options,
  onChange,
}: {
  value: string | null;
  options: readonly string[];
  onChange: (issue: string | null) => void;
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
        {value === null ? 'All Issues' : getIssueDisplayName(value)}
        <span className="text-xs leading-none">▾</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-10 mt-1 max-h-72 min-w-[16rem] overflow-y-auto rounded-md border border-gray-200 bg-white py-1 shadow-md"
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
            All Issues
          </button>
          {options.length > 0 && (
            <div className="my-1 border-t border-gray-100" />
          )}
          {options.map((slug) => (
            <button
              key={slug}
              type="button"
              role="menuitem"
              onClick={() => {
                onChange(slug);
                setOpen(false);
              }}
              className={`block w-full px-3 py-2 text-left text-sm hover:bg-brand hover:text-white ${
                slug === value ? 'font-semibold text-brand' : 'text-gray-800'
              }`}
            >
              {getIssueDisplayName(slug)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
