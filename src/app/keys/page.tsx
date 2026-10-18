import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { Empty, KeyRow, Panel } from '@/components/ui';
import { AddKey } from '@/components/add-forms';
import { daysUntil } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function Keys({ searchParams }: { searchParams: Promise<{ q?: string; f?: string }> }) {
  const { q, f } = await searchParams;
  const query = (q ?? '').trim();
  const where: Prisma.KeySetWhereInput = query
    ? {
        OR: [
          { code: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
          { holder: { contains: query, mode: 'insensitive' } },
          { building: { name: { contains: query, mode: 'insensitive' } } },
        ],
      }
    : {};
  const [keys, buildings, recent] = await Promise.all([
    prisma.keySet.findMany({
      where,
      include: {
        building: { select: { id: true, name: true } },
        loans: { where: { returnedAt: null }, select: { expectedReturn: true, purpose: true }, take: 1 },
      },
      orderBy: { code: 'asc' },
    }),
    prisma.building.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.keyLoan.findMany({
      where: { returnedAt: { not: null } },
      orderBy: { returnedAt: 'desc' },
      take: 8,
      include: { keySet: { select: { id: true, code: true, description: true } } },
    }),
  ]);
  const lent = keys
    .filter((k) => k.holder)
    .sort((a, b) => (a.borrowedAt?.getTime() ?? 0) - (b.borrowedAt?.getTime() ?? 0));
  const late = lent.filter((k) => k.loans[0]?.expectedReturn && daysUntil(k.loans[0].expectedReturn) < 0).length;
  const home = keys.filter((k) => !k.holder);
  const tab = f === 'home' ? 'home' : 'out';

  return (
    <>
      <div className="head">
        <div>
          <h1>Klíče</h1>
          <p className="muted">
            {lent.length} venku{late ? ` · ${late} po termínu` : ''} · {home.length} v kanceláři
          </p>
        </div>
      </div>
      <form className="searchbar" role="search">
        {tab === 'home' && <input type="hidden" name="f" value="home" />}
        <input name="q" type="search" defaultValue={query} placeholder="Hledat kód, dům nebo kdo má klíče…" aria-label="Hledat klíče" />
      </form>
      <div className="filters scroll">
        <Link href={`/keys${query ? `?q=${encodeURIComponent(query)}` : ''}`} className="chip" aria-current={tab === 'out' ? 'true' : undefined}>
          Venku <span className="cnt">{lent.length}</span>
        </Link>
        <Link href={`/keys?f=home${query ? `&q=${encodeURIComponent(query)}` : ''}`} className="chip" aria-current={tab === 'home' ? 'true' : undefined}>
          V kanceláři <span className="cnt">{home.length}</span>
        </Link>
      </div>
      <div className="stack">
        {tab === 'out' ? (
          <Panel title="Zapůjčené" count={lent.length}>
            {lent.length ? (
              lent.map((k) => <KeyRow key={k.id} k={k} loan={k.loans[0]} />)
            ) : (
              <Empty>{query ? `Nic neodpovídá „${query}“.` : 'Všechny klíče jsou v kanceláři.'}</Empty>
            )}
          </Panel>
        ) : (
          <Panel title="V kanceláři" count={home.length} action={<AddKey buildings={buildings} />}>
            {home.length ? home.map((k) => <KeyRow key={k.id} k={k} />) : <Empty>Nic tu není.</Empty>}
          </Panel>
        )}
        {!query && recent.length > 0 && (
          <Panel title="Naposledy vrácené">
            {recent.map((l) => (
              <Link key={l.id} href={`/keys/${l.keySet.id}`} className="row click">
                <div className="main">
                  <div className="t">
                    <span className="code">{l.keySet.code}</span>
                    {l.holderCompany || l.holder}
                  </div>
                  <div className="s">
                    <span>{l.purpose ?? l.keySet.description}</span>
                  </div>
                </div>
                <div className="acts">
                  <span className="mono due">
                    {l.returnedAt && new Intl.DateTimeFormat('cs-CZ', { timeZone: 'Europe/Prague', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }).format(l.returnedAt)}
                  </span>
                </div>
              </Link>
            ))}
          </Panel>
        )}
      </div>
    </>
  );
}
