'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Jost } from 'next/font/google';
import Link from 'next/link';

const jost = Jost({ subsets: ['latin'], weight: ['500', '600', '700'] });

const PRIMARY_NAV_ITEMS = [
  { href: '/scores', label: 'Explore the Data', disabled: false },
  { href: '/chamber', label: 'Chamber', disabled: true },
  { href: '/party', label: 'Party', disabled: true },
  { href: '/issues', label: 'Issue Areas', disabled: true },
] as const;

const UTILITY_NAV_LINKS = [
  { href: '/data', label: 'Data' },
  { href: '/about', label: 'About' },
  { href: '/research', label: 'Research' },
] as const;

function NavDropdown({
  label,
  items,
}: {
  label: string;
  items: ReadonlyArray<{ href: string; label: string; disabled?: boolean }>;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-1 text-brand hover:text-brand-dark hover:underline"
      >
        {label}
        <span className="text-xs leading-none">▾</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-20 mt-2 min-w-[14rem] rounded-md border border-gray-200 bg-white py-1 shadow-md"
        >
          {items.map((item) =>
            item.disabled ? (
              <span
                key={item.href}
                role="menuitem"
                aria-disabled
                className="block cursor-not-allowed px-3 py-2 text-sm text-gray-400"
              >
                {item.label}
              </span>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="block px-3 py-2 text-sm text-gray-800 hover:bg-brand hover:text-white"
              >
                {item.label}
              </Link>
            ),
          )}
        </div>
      )}
    </div>
  );
}

export function SiteHeader() {
  return (
    <header className="border-b-2 border-brand bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-4">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/logo.png"
            alt="Portman Center logo"
            width={40}
            height={41}
            priority
          />
          <span
            className={`${jost.className} text-sm font-bold leading-tight tracking-wider`}
          >
            <span className="text-brand">PORTMAN CENTER</span>{' '}
            <span className="text-gray-800">FOR POLICY SOLUTIONS</span>
          </span>
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <NavDropdown label="Bipartisanship Scores" items={PRIMARY_NAV_ITEMS} />
          {UTILITY_NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-brand hover:text-brand-dark hover:underline"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
