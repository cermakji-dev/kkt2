import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { displayName, getUser } from '@/lib/auth';
import { Empty, Panel, Pill } from '@/components/ui';
import { AddBuilding } from '@/components/add-forms';
import { daysUntil, latestPerType } from '@/lib/format';

export const dynamic = 'force-dynamic';

const person = { select: { id: true, name: true, email: true } } as const;

export default async function Buildings({ searchParams }: { searchParams: Promise<{ f?: string; q?: string }> }) {
  const me = (await getUser())!;
  const { f, q } = await searchParams;
  const mineCount = await prisma.building.count({ where: { OR: [{ technicianId: me.id }, { referentId: me.id }] } });
  // Kdo má přiřazené objekty, vidí nejdřív svoje.
  const mine = f === 'mine' || (f !== 'all' && mineCount > 0 && me.role !== 'ADMIN');
  const query = (q ?? '').trim();

  const where: Prisma.BuildingWhereInput = {
    ...(mine ? { OR: [{ technicianId: me.id }, { referentId: me.id }] } : {}),
    ...(query
      ? { AND: [{ OR: [{ name: { contains: query, mode: 'insensitive' } }, { address: { contains: query, mode: 'insensitive' } }] }] }
      : {}),
  };

  const buildings = await prisma.building.findMany({
    where,
    orderBy: { name: 'asc' },
    include: {
      technician: person,
      referent: person,
      _count: { select: { keys: true } },
      tasks: { where: { status: { not: 'DONE' } }, select: { id: true } },
      inspections: { select: { buildingId: true, type: true, inspectedAt: true, nextDue: true, result: true } },
    },
  });

  return (
    <>
      <div className="head">
        <div>
          <h1>Objekty</h1>
          <p className="muted">Spravované bytové domy. Klepnutím otevřete kartu objektu.</p>
        </div>
      </div>
      <form className="searchbar" role="search">
        {mine && <input type="hidden" name="f" value="mine" />}
        {!mine && f === 'all' && <input type="hidden" name="f" value="all" />}
        <input name="q" type="search" defaultValue={query} placeholder="Hledat název nebo adresu…" aria-label="Hledat objekt" />
      </form>
      <div className="filters scroll">
        <Link href={`/buildings?f=mine${query ? `&q=${encodeURIComponent(query)}` : ''}`} className="chip" aria-current={mine ? 'true' : undefined}>
          Moje <span className="cnt">{mineCount}</span>
        </Link>
        <Link href={`/buildings?f=all${query ? `&q=${encodeURIComponent(query)}` : ''}`} className="chip" aria-current={!mine ? 'true' : undefined}>
          Všechny
        </Link>
      </div>
      <Panel title={mine ? 'Moje objekty' : 'Všechny objekty'} count={buildings.length} action={me.role === 'ADMIN' ? <AddBuilding /> : undefined}>
        {buildings.length ? (
          buildings.map((b) => {
            const latest = latestPerType(b.inspections);
            const late = latest.filter((x) => x.nextDue && daysUntil(x.nextDue) < 0).length;
            const defect = latest.filter((x) => x.result === 'DEFECT').length;
            return (
              <Link key={b.id} href={`/buildings/${b.id}`} className="row click">
                <div className="main">
                  <div className="t">{b.name}</div>
                  <div className="s">
                    <span>{b.address}</span>
                    {b.units != null && <span>{b.units} bytů</span>}
                  </div>
                  <div className="s people">
                    <span>
                      <i>T</i> {displayName(b.technician)}
                    </span>
                    <span>
                      <i>R</i> {displayName(b.referent)}
                    </span>
                  </div>
                </div>
                <div className="acts">
                  {late > 0 && <Pill tone="bad">{late} po termínu</Pill>}
                  {defect > 0 && <Pill tone="warn">{defect} se závadou</Pill>}
                  <span className="mono due">
                    {b.tasks.length} úk. · {b._count.keys} klíčů
                  </span>
                </div>
              </Link>
            );
          })
        ) : (
          <Empty>
            {query ? `Nic neodpovídá „${query}“.` : mine ? 'Nemáte přiřazené žádné objekty.' : 'Zatím žádné objekty.'}
          </Empty>
        )}
      </Panel>
    </>
  );
}
