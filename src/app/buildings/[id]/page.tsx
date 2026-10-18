import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { Empty, InspectionRow, KeyRow, Panel, TaskRow } from '@/components/ui';
import { AddInspection, AddKey, AddTask } from '@/components/add-forms';
import { DeleteButton } from '@/components/forms';
import { deleteBuilding } from '@/app/actions';
import { fmtDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function BuildingDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await prisma.building.findUnique({
    where: { id },
    include: {
      tasks: { orderBy: [{ status: 'asc' }, { dueAt: 'asc' }] },
      keys: { orderBy: { code: 'asc' } },
      inspections: { orderBy: { inspectedAt: 'desc' } },
    },
  });
  if (!b) notFound();
  const linked = b.tasks.length + b.keys.length + b.inspections.length;

  return (
    <>
      <Link href="/buildings" className="back">
        ← Všechny objekty
      </Link>
      <div className="head">
        <div>
          <h1>{b.name}</h1>
          <div className="meta">
            <span>{b.address}</span>
            {b.units != null && <span>{b.units} bytů</span>}
            <span className="mono">v evidenci od {fmtDate(b.createdAt)}</span>
          </div>
        </div>
        <div>
          {linked ? (
            <span className="muted small">Smazat lze jen objekt bez navázaných záznamů</span>
          ) : (
            <DeleteButton action={deleteBuilding} id={b.id} label="Smazat objekt" />
          )}
        </div>
      </div>
      <div className="stack">
        {b.notes && (
          <section className="panel">
            <header>
              <h2>Poznámka</h2>
            </header>
            <p className="notes">{b.notes}</p>
          </section>
        )}
        <div className="grid2">
          <Panel title="Úkoly" count={b.tasks.length} action={<AddTask buildings={[]} buildingId={b.id} />}>
            {b.tasks.length ? b.tasks.map((t) => <TaskRow key={t.id} t={t} showBuilding={false} />) : <Empty>Žádné úkoly.</Empty>}
          </Panel>
          <Panel title="Klíče" count={b.keys.length} action={<AddKey buildings={[]} buildingId={b.id} />}>
            {b.keys.length ? b.keys.map((k) => <KeyRow key={k.id} k={k} showBuilding={false} />) : <Empty>Žádné svazky klíčů.</Empty>}
          </Panel>
        </div>
        <Panel
          title="Kontroly a revize"
          count={b.inspections.length}
          action={<AddInspection buildings={[]} buildingId={b.id} />}
        >
          {b.inspections.length ? (
            b.inspections.map((x) => <InspectionRow key={x.id} x={x} showBuilding={false} />)
          ) : (
            <Empty>Zatím žádná kontrola.</Empty>
          )}
        </Panel>
      </div>
    </>
  );
}
