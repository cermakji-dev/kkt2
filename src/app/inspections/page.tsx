import { prisma } from '@/lib/prisma';
import { Empty, InspectionRow, Panel } from '@/components/ui';
import { AddInspection } from '@/components/add-forms';
import { latestPerType } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function Inspections() {
  const [all, buildings] = await Promise.all([
    prisma.inspection.findMany({
      include: { building: { select: { id: true, name: true } } },
      orderBy: { inspectedAt: 'desc' },
    }),
    prisma.building.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ]);
  const plan = latestPerType(all).sort(
    (a, b) => (a.nextDue?.getTime() ?? Infinity) - (b.nextDue?.getTime() ?? Infinity),
  );

  return (
    <>
      <div className="head">
        <div>
          <h1>Kontroly a revize</h1>
          <p className="muted">Poslední kontrola každého druhu v každém objektu a kdy je na řadě další.</p>
        </div>
      </div>
      <div className="stack">
        <Panel title="Plán dalších termínů" count={plan.length} action={<AddInspection buildings={buildings} />}>
          {plan.length ? plan.map((x) => <InspectionRow key={x.id} x={x} />) : <Empty>Zatím žádná kontrola.</Empty>}
        </Panel>
        <Panel title="Historie" count={all.length}>
          {all.length ? all.map((x) => <InspectionRow key={x.id} x={x} />) : <Empty>Historie je prázdná.</Empty>}
        </Panel>
      </div>
    </>
  );
}
