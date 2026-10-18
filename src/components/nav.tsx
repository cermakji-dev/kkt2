'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS = [
  { href: '/', label: 'Přehled' },
  { href: '/buildings', label: 'Objekty' },
  { href: '/tasks', label: 'Úkoly' },
  { href: '/keys', label: 'Klíče' },
  { href: '/inspections', label: 'Kontroly' },
] as const;

export default function Nav({ counts }: { counts: Partial<Record<string, number>> }) {
  const path = usePathname();
  return (
    <nav aria-label="Moduly">
      {ITEMS.map((it) => {
        const active = it.href === '/' ? path === '/' : path.startsWith(it.href);
        const n = counts[it.href];
        return (
          <Link key={it.href} href={it.href} aria-current={active ? 'page' : undefined}>
            {it.label}
            {n ? <span className="n">{n}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
