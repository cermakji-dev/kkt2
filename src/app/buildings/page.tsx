import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { displayName, getUser, initials } from '@/lib/auth';
import { AddBuilding } from '@/components/add-forms';
import { daysUntil, fmtDate, latestPerType } from '@/lib/format';
import { buildingHealth } from '@/lib/health';

export const dynamic = 'force-dynamic';

const person = { select: { id: true, name: true, email: true } } as const;

export default async function Buildings({ searchParams }: { searchParams: Promise<{ f?: string; q?: string; h?: string }> }) {
  const me = (await getUser())!;
  const { f, q, h } = await searchParams;
  const mineWhere: Prisma.BuildingWhereInput = { OR: [{ technicianId: me.id }, { referentId: me.id }] };
  const mineCount = await prisma.building.count({ where: mineWhere });
  const mine = f === 'mine' || (f !== 'all' && mineCount > 0 && me.role !== 'ADMIN');
  const query = (q ?? '').trim();

  const where: Prisma.BuildingWhereInput = {
    AND: [
      mine ? mineWhere : {},
      query ? { OR: [{ name: { contains: query, mode: 'insensitive' } }, { address: { contains: query, mode: 'insensitive' } }] } : {},
    ],
  };

  const list = await prisma.building.findMany({
    where,
    orderBy: { name: 'asc' },
    include: {
      technician: person,
      referent: person,
      tasks: { where: { status: { not: 'DONE' }, parentId: null }, select: { status: true, dueAt: true, priority: true } },
      keys: { select: { holder: true } },
      inspections: { select: { buildingId: true, type: true, inspectedAt: true, nextDue: true, result: true } },
    },
  });
  const rows = list.map((b) => {
    const health = buildingHealth({ tasks: b.tasks, inspections: b.inspections });
    const next = latestPerType(b.inspections)
      .filter((x) => x.nextDue)
      .sort((a, c) => a.nextDue!.getTime() - c.nextDue!.getTime())[0];
    return { b, health, next };
  });
  const order = { bad: 0, warn: 1, ok: 2 } as const;
  rows.sort((a, c) => order[a.health.tone] - order[c.health.tone] || a.b.name.localeCompare(c.b.name, 'cs'));
  const tally = { bad: rows.filter((r) => r.health.tone === 'bad').length, warn: rows.filter((r) => r.health.tone === 'warn').length, ok: rows.filter((r) => r.health.tone === 'ok').length };
  const shown = h === 'bad' || h === 'warn' || h === 'ok' ? rows.filter((r) => r.health.tone === h) : rows;

  const link = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const m = { f: mine ? 'mine' : f === 'all' ? 'all' : undefined, q: query || undefined, h, ...over };
    for (const [k, v] of Object.entries(m)) if (v) p.set(k, v);
    const qs = p.toString();
    return '/buildings' + (qs ? '?' + qs : '');
  };

  return (
    <>
      <div className="head">
        <div>
          <h1>Objekty</h1>
          <p className="muted">
            {rows.length} {mine ? 'mých ' : ''}objektů · seřazeno podle toho, co hoří
          </p>
        </div>
      </div>
      {me.role === 'ADMIN' && (
        <section className="panel addbar">
          <header>
            <h2 className="muted">Správa objektů</h2>
            <AddBuilding />
          </header>
        </section>
      )}

      <form className="searchbar" role="search">
        {mine && <input type="hidden" name="f" value="mine" />}
        {!mine && f === 'all' && <input type="hidden" name="f" value="all" />}
        <input name="q" type="search" defaultValue={query} placeholder="Hledat název nebo adresu…" aria-label="Hledat objekt" />
      </form>
      <div className="filters scroll">
        <Link href={link({ f: 'mine' })} className="chip" aria-current={mine ? 'true' : undefined}>
          Moje <span className="cnt">{mineCount}</span>
        </Link>
        <Link href={link({ f: 'all' })} className="chip" aria-current={!mine ? 'true' : undefined}>
          Všechny
        </Link>
        <span className="fsep" />
        <Link href={link({ h: h === 'bad' ? undefined : 'bad' })} className="chip hchip bad" aria-current={h === 'bad' ? 'true' : undefined}>
          Pozornost <span className="cnt">{tally.bad}</span>
        </Link>
        <Link href={link({ h: h === 'warn' ? undefined : 'warn' })} className="chip hchip warn" aria-current={h === 'warn' ? 'true' : undefined}>
          Brzy <span className="cnt">{tally.warn}</span>
        </Link>
        <Link href={link({ h: h === 'ok' ? undefined : 'ok' })} className="chip hchip ok" aria-current={h === 'ok' ? 'true' : undefined}>
          V pořádku <span className="cnt">{tally.ok}</span>
        </Link>
      </div>

      {shown.length ? (
        <div className="bgrid">
          {shown.map(({ b, health, next }) => {
            const out = b.keys.filter((k) => k.holder).length;
            return (
              <Link key={b.id} href={`/buildings/${b.id}`} className={'bcard2 ' + health.tone}>
                <div className="bc-top">
                  <span className={'hdot ' + health.tone} aria-hidden="true" />
                  <span className="bc-status">{health.label}</span>
                  {b.units != null && <span className="bc-units">{b.units} b. j.</span>}
                </div>
                <h3>{b.name}</h3>
                <p className="bc-addr">{b.address}</p>
                <p className={'bc-why ' + health.tone}>{health.reasons.join(' · ')}</p>
                <div className="bc-stats">
                  <span>
                    <b>{b.tasks.length}</b> úkolů
                  </span>
                  <span>
                    <b>{out}</b>/{b.keys.length} klíčů venku
                  </span>
                  <span>
                    {next ? (
                      <>
                        další kontrola <b className={daysUntil(next.nextDue!) < 0 ? 'bad' : ''}>{fmtDate(next.nextDue)}</b>
                      </>
                    ) : (
                      'bez plánu kontrol'
                    )}
                  </span>
                </div>
                <div className="bc-people">
                  {[
                    { r: 'T', p: b.technician },
                    { r: 'R', p: b.referent },
                  ].map(({ r, p }) => (
                    <span key={r} className="bc-person" title={(r === 'T' ? 'Technik: ' : 'Referent: ') + displayName(p)}>
                      <span className={'avatar xs' + (p ? '' : ' empty')}>{p ? initials(p) : '?'}</span>
                      <span>{p ? displayName(p) : r === 'T' ? 'bez technika' : 'bez referenta'}</span>
                    </span>
                  ))}
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="panel empty big-empty">
          <b>Nic tu není</b>
          <span>{query ? `Nic neodpovídá „${query}“.` : mine ? 'Nemáte přiřazené žádné objekty.' : 'Zatím žádné objekty.'}</span>
        </div>
      )}
    </>
  );
}
