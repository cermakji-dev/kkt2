import './globals.css';
import Link from 'next/link';
export const metadata = { title: 'iSYS | Správa objektů', description: 'Interní informační systém techniků' };
export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) {
  return <html lang="cs"><body><div className="shell"><aside><div className="logo">iSYS<span> / TECH</span></div><nav><Link href="/">Přehled</Link><Link href="/buildings">Objekty</Link></nav><small>Vývojová verze • bez přihlášení</small></aside><main>{children}</main></div></body></html>;
}
