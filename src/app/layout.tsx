import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Archivo, IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';
import Nav from '@/components/nav';
import { getUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const display = Archivo({ subsets: ['latin', 'latin-ext'], axes: ['wdth'], variable: '--font-display', display: 'swap' });
const body = IBM_Plex_Sans({ subsets: ['latin', 'latin-ext'], weight: ['400', '500', '600'], variable: '--font-body', display: 'swap' });
const mono = IBM_Plex_Mono({ subsets: ['latin', 'latin-ext'], weight: ['400', '500'], variable: '--font-mono', display: 'swap' });

export const metadata: Metadata = { title: 'iSYS | Správa objektů', description: 'Interní informační systém techniků' };
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#1e2a25' },
    { media: '(prefers-color-scheme: dark)', color: '#0c110f' },
  ],
};

async function navCounts() {
  const [tasks, lent] = await Promise.all([
    prisma.task.count({ where: { status: { not: 'DONE' } } }),
    prisma.keySet.count({ where: { holder: { not: null } } }),
  ]);
  return { '/tasks': tasks, '/keys': lent };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await getUser();
  const fonts = `${display.variable} ${body.variable} ${mono.variable}`;

  if (!user) {
    return (
      <html lang="cs" className={fonts}>
        <body>
          <main className="center">{children}</main>
        </body>
      </html>
    );
  }

  const counts = await navCounts();
  return (
    <html lang="cs" className={fonts}>
      <body>
        <div className="shell">
          <aside>
            <div className="logo">
              iSYS<span>TECH</span>
            </div>
            <Nav counts={counts} />
            <div className="who">
              <small>{user.email}</small>
              <form action="/auth/signout" method="post">
                <button className="linkbtn">Odhlásit</button>
              </form>
            </div>
          </aside>
          <main className="work">{children}</main>
        </div>
      </body>
    </html>
  );
}
