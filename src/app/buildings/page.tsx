import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { Empty, Panel, Pill } from '@/components/ui';
import { AddBuilding } from '@/components/add-forms';
import { daysUntil, latestPerType } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function Buildings() {
  const buildings = await prisma.building.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { keys: true } },
      tasks: { where: { status: { not: 'DONE' } }, select: { id: true } },
      inspections: { select: { buildingId: true, type: true, inspectedAt: true, nextDue: true, result: true } },
    },
  });

  return (
    <>
      <div className="head">
        <div>
          <h1>Evidence objektů</h1>
          <p className="muted">Spravované bytové domy. Klikněte na objekt pro detail.</p>
        </div>
      </div>
      <Panel title="Objekty" count={buildings.length} action={<AddBuilding />}>
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
          <Empty>Zatím žádné objekty. Přidejte první tlačítkem Nový objekt.</Empty>
        )}
      </Panel>
    </>
  );
}
