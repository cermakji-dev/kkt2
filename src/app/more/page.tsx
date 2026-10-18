import Link from 'next/link';
import { getUser } from '@/lib/auth';
import { Icon, type NavItem } from '@/components/nav';

export default async function More() {
  const me = (await getUser())!;
  const items: (NavItem & { desc: string })[] = [
    { href: '/inspections', label: 'Kontroly', icon: 'clipboard', desc: 'Protokoly a plán revizí' },
    { href: '/keys', label: 'Klíče', icon: 'key', desc: 'Výpůjčky a předávací protokoly' },
    { href: '/suppliers', label: 'Dodavatelé', icon: 'truck', desc: 'Firmy, havarijní linky, smlouvy' },
    { href: '/attendance', label: 'Docházka', icon: 'clock', desc: 'Příchod, odchod, přerušení' },
    { href: '/leave', label: 'Dovolená', icon: 'sun', desc: 'Žádosti a čerpání' },
    { href: '/profile', label: 'Můj profil', icon: 'users', desc: 'Jméno, telefon, heslo' },
    ...(me.role === 'ADMIN' ? [{ href: '/users', label: 'Uživatelé', icon: 'users' as const, desc: 'Účty a role' }] : []),
  ];
  return (
    <>
      <div className="head">
        <div>
          <h1>Další moduly</h1>
        </div>
      </div>
      <div className="moregrid">
        {items.map((it) => (
          <Link key={it.href} href={it.href} className="moretile">
            <span className="mt-ic">
              <Icon name={it.icon} />
            </span>
            <b>{it.label}</b>
            <span className="muted small">{it.desc}</span>
          </Link>
        ))}
      </div>
    </>
  );
}
