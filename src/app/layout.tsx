import './globals.css';
import Link from 'next/link';
import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Nav, { TabBar, type NavItem } from '@/components/nav';
import { displayName, getUser, initials, ROLE_LABEL } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { elog } from '@/lib/e2e';

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
  elog('layout start');
  const user = await getUser();
  elog('layout user');
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
  elog('layout counts');
  const main: NavItem[] = [
    { href: '/', label: 'Přehled', icon: 'home' },
    { href: '/buildings', label: 'Objekty', icon: 'building' },
    { href: '/tasks', label: 'Úkoly', icon: 'check', count: myTasks },
    { href: '/keys', label: 'Klíče', icon: 'key', count: lent },
    { href: '/inspections', label: 'Kontroly', icon: 'clipboard' },
  ];
  const pendingLeaves = user.role === 'ADMIN' ? await prisma.leaveRequest.count({ where: { status: 'PENDING' } }) : 0;
  const side: NavItem[] = [
    ...main,
    { href: '/attendance', label: 'Docházka', icon: 'clock' },
    { href: '/leave', label: 'Dovolená', icon: 'sun', count: pendingLeaves },
    ...(user.role === 'ADMIN' ? [{ href: '/users', label: 'Uživatelé', icon: 'users' } as NavItem] : []),
  ];

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
              <Link href="/attendance" className="top-ic" aria-label="Docházka">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                  <path d="M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z" />
                </svg>
              </Link>
              <Link href="/leave" className="top-ic" aria-label="Dovolená">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                  <path d="M12 3v2M12 19v2M5 12H3M21 12h-2M6.3 6.3L4.9 4.9M19.1 19.1l-1.4-1.4M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
                </svg>
                {pendingLeaves > 0 && <span className="top-dot" />}
              </Link>
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
