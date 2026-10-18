'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export type NavItem = { href: string; label: string; icon: keyof typeof ICONS; count?: number; hot?: boolean };

const ICONS = {
  home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  building: 'M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16M15 9h4a1 1 0 0 1 1 1v11M8 8h3M8 12h3M8 16h3M3 21h18',
  check: 'M4 12l5 5L20 6',
  key: 'M14 10a4 4 0 1 0-3.9 4H11l1.5 1.5L14 14l1.5 1.5L17 14l2 2 2-2-6.2-6.2A4 4 0 0 0 14 10zM8 10h.01',
  clipboard: 'M9 4h6v3H9zM7 5H5v16h14V5h-2M9 12l2 2 4-4',
  users: 'M16 20v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 20v-1a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  clock: 'M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
  sun: 'M12 3v2M12 19v2M5 12H3M21 12h-2M6.3 6.3L4.9 4.9M19.1 19.1l-1.4-1.4M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  alert: 'M12 3l9.5 16.5H2.5zM12 10v4M12 17.5h.01',
  truck: 'M2 7h11v9H2zM13 10h4l3 3v3h-7M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
} as const;

export function Icon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}

function useActive() {
  const path = usePathname();
  return (href: string) => (href === '/' ? path === '/' : path === href || path.startsWith(href + '/'));
}

export default function Nav({ items }: { items: NavItem[] }) {
  const isActive = useActive();
  return (
    <nav aria-label="Moduly" className="side-nav">
      {items.map((it) => (
        <Link key={it.href} href={it.href} aria-current={isActive(it.href) ? 'page' : undefined}>
          <Icon name={it.icon} />
          <span className="lbl">{it.label}</span>
          {it.count ? <span className={'n' + (it.hot ? ' hot' : '')}>{it.count}</span> : null}
        </Link>
      ))}
    </nav>
  );
}

/** Spodní lišta na mobilu: hlavní moduly na dosah palce. */
export function TabBar({ items }: { items: NavItem[] }) {
  const isActive = useActive();
  return (
    <nav aria-label="Hlavní moduly" className="tabbar">
      {items.map((it) => (
        <Link key={it.href} href={it.href} aria-current={isActive(it.href) ? 'page' : undefined}>
          <span className="ic">
            <Icon name={it.icon} />
            {it.count ? <span className={'dot' + (it.hot ? ' hot' : '')}>{it.count > 99 ? '99+' : it.count}</span> : null}
          </span>
          <span>{it.label}</span>
        </Link>
      ))}
    </nav>
  );
}
