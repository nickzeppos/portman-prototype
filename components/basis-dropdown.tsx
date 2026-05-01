'use client';

import { useRef, useState } from 'react';
import { useDismissOnOutside } from '@/lib/use-dismiss-on-outside';

export type Basis = 'chamber' | 'party';

export function BasisDropdown({
  value,
  onChange,
}: {
  value: Basis;
  onChange: (b: Basis) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismissOnOutside(ref, open, () => setOpen(false));

  const labelFor = (b: Basis) => (b === 'chamber' ? 'By Chamber' : 'By Party');

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-1 hover:text-brand"
      >
        {labelFor(value)}
        <span className="text-xs leading-none">▾</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-10 mt-1 min-w-[14rem] rounded-md border border-gray-200 bg-white py-1 shadow-md"
        >
          {(['chamber', 'party'] as const).map((b) => (
            <button
              key={b}
              type="button"
              role="menuitem"
              onClick={() => {
                onChange(b);
                setOpen(false);
              }}
              className={`block w-full px-3 py-2 text-left text-sm hover:bg-brand hover:text-white ${
                b === value ? 'font-semibold text-brand' : 'text-gray-800'
              }`}
            >
              {labelFor(b)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
