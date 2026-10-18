import './globals.css';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'iSYS | Správa objektů', description: 'Interní informační systém techniků' };

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html lang="cs">
      <body>
        {user ? (
          <div className="shell">
            <aside>
              <div className="logo">iSYS<span> / TECH</span></div>
              <nav>
                <Link href="/">Přehled</Link>
                <Link href="/buildings">Objekty</Link>
              </nav>
              <div className="who">
                <small>{user.email}</small>
                <form action="/auth/signout" method="post">
                  <button className="link">Odhlásit</button>
                </form>
              </div>
            </aside>
            <main>{children}</main>
          </div>
        ) : (
          <main className="center">{children}</main>
        )}
      </body>
    </html>
  );
}
