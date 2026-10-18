import './globals.css';
import Link from 'next/link';
import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Nav, { TabBar, type NavItem } from '@/components/nav';
import { displayName, getUser, initials, ROLE_LABEL } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const body = Geist({ subsets: ['latin', 'latin-ext'], variable: '--font-body', display: 'swap' });
const mono = Geist_Mono({ subsets: ['latin', 'latin-ext'], variable: '--font-mono', display: 'swap' });

export const metadata: Metadata = {
  title: 'iSYS | Správa objektů',
  description: 'Interní informační systém techniků',
  appleWebApp: { capable: true, title: 'iSYS', statusBarStyle: 'black-translucent' },
};
export const viewport: Viewport = {
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#09090b' },
    { media: '(prefers-color-scheme: dark)', color: '#09090b' },
  ],
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await getUser();
  const fonts = `${body.variable} ${mono.variable}`;

  if (!user || !user.active) {
    return (
      <html lang="cs" className={fonts}>
        <body>
          <main className="center">
            {user && !user.active ? (
              <div className="login">
                <h1>Účet je deaktivovaný</h1>
                <p className="muted">Obraťte se na administrátora.</p>
                <form action="/auth/signout" method="post">
                  <button className="btn">Odhlásit se</button>
                </form>
              </div>
            ) : (
              children
            )}
          </main>
        </body>
      </html>
    );
  }

  const [myTasks, lent] = await Promise.all([
    prisma.task.count({ where: { status: { not: 'DONE' }, assigneeId: user.id } }),
    prisma.keySet.count({ where: { holder: { not: null } } }),
  ]);
  const main: NavItem[] = [
    { href: '/', label: 'Přehled', icon: 'home' },
    { href: '/buildings', label: 'Objekty', icon: 'building' },
    { href: '/tasks', label: 'Úkoly', icon: 'check', count: myTasks },
    { href: '/keys', label: 'Klíče', icon: 'key', count: lent },
    { href: '/inspections', label: 'Kontroly', icon: 'clipboard' },
  ];
  const side: NavItem[] = [...main, ...(user.role === 'ADMIN' ? [{ href: '/users', label: 'Uživatelé', icon: 'users' } as NavItem] : [])];

  return (
    <html lang="cs" className={fonts}>
      <body>
        <div className="shell">
          <aside>
            <Link href="/" className="logo">
              <span className="mark" aria-hidden="true" />
              iSYS
            </Link>
            <Nav items={side} />
            <Link href="/profile" className="me">
              <span className="avatar" aria-hidden="true">{initials(user)}</span>
              <span className="me-txt">
                <b>{displayName(user)}</b>
                <small>{ROLE_LABEL[user.role]}</small>
              </span>
            </Link>
          </aside>
          <header className="topbar">
            <Link href="/" className="logo">
              <span className="mark" aria-hidden="true" />
              iSYS
            </Link>
            <div className="top-act">
              {user.role === 'ADMIN' && (
                <Link href="/users" className="top-ic" aria-label="Uživatelé">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                    <path d="M16 20v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
                  </svg>
                </Link>
              )}
              <Link href="/profile" className="avatar" aria-label="Můj profil">
                {initials(user)}
              </Link>
            </div>
          </header>
          <main className="work">{children}</main>
          <TabBar items={main} />
        </div>
      </body>
    </html>
  );
}
