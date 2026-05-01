'use client';

import { useRef, useState } from 'react';
import { ordinal } from '@/lib/format';
import { useDismissOnOutside } from '@/lib/use-dismiss-on-outside';

export function CongressDropdown({
  value,
  options,
  onChange,
}: {
  value: number;
  options: readonly number[];
  onChange: (c: number) => void;
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
        {ordinal(value)} Congress
        <span className="text-xs leading-none">▾</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-10 mt-1 min-w-[12rem] rounded-md border border-gray-200 bg-white py-1 shadow-md"
        >
          {options.map((c) => (
            <button
              key={c}
              type="button"
              role="menuitem"
              onClick={() => {
                onChange(c);
                setOpen(false);
              }}
              className={`block w-full px-3 py-2 text-left text-sm hover:bg-brand hover:text-white ${
                c === value ? 'font-semibold text-brand' : 'text-gray-800'
              }`}
            >
              {ordinal(c)} Congress
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
