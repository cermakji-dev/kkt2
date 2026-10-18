import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="head">
      <div>
        <h1>Stránka nenalezena</h1>
        <p className="muted">
          Záznam neexistuje nebo byl smazán. <Link href="/">Zpět na přehled</Link>
        </p>
      </div>
    </div>
  );
}
