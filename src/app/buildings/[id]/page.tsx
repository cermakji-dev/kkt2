import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { Empty, InspectionRow, KeyRow, Panel } from '@/components/ui';
import { TaskItem, taskItemInclude } from '@/components/task-item';
import { AddInspection, AddKey, AddTask } from '@/components/add-forms';
import { ActionForm, DeleteButton } from '@/components/forms';
import { assignBuilding, deleteBuilding } from '@/app/actions';
import { fmtDate } from '@/lib/format';
import { displayName, getUser } from '@/lib/auth';
import { activePeople } from '@/lib/people';
import { StartReport } from '@/components/start-report';
import { ReportRow, reportInclude } from '@/components/report-list';

export const dynamic = 'force-dynamic';

export default async function BuildingDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const person = { select: { id: true, name: true, email: true, phone: true } } as const;
  const [me, people, b] = await Promise.all([
    getUser(),
    activePeople(),
    prisma.building.findUnique({
    where: { id },
    include: {
      technician: person,
      referent: person,
      tasks: { where: { parentId: null }, orderBy: [{ status: 'asc' }, { dueAt: 'asc' }], include: taskItemInclude },
      keys: { orderBy: { code: 'asc' } },
      inspections: { orderBy: { inspectedAt: 'desc' } },
      reports: { include: reportInclude, orderBy: { date: 'desc' }, take: 20 },
    },
    }),
  ]);
  if (!b) notFound();
  const isAdmin = me?.role === 'ADMIN';
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
          {isAdmin &&
            (linked ? (
              <span className="muted small">Smazat lze jen objekt bez navázaných záznamů</span>
            ) : (
              <DeleteButton action={deleteBuilding} id={b.id} label="Smazat objekt" />
            ))}
        </div>
      </div>
      <div className="stack">
        <section className="panel">
          <header>
            <h2>Kdo se stará</h2>
          </header>
          <div className="contacts">
            {[
              { role: 'Technik', p: b.technician },
              { role: 'Referent', p: b.referent },
            ].map(({ role, p }) => (
              <div key={role} className="contact">
                <span className="lbl">{role}</span>
                <b>{displayName(p)}</b>
                {p?.phone && (
                  <a href={`tel:${p.phone.replace(/\s/g, '')}`} className="mono">
                    {p.phone}
                  </a>
                )}
                {p && <span className="muted small">{p.email}</span>}
              </div>
            ))}
          </div>
          {isAdmin && (
            <details className="assign">
              <summary>Změnit přiřazení</summary>
              <ActionForm action={assignBuilding} submitLabel="Uložit přiřazení">
                <input type="hidden" name="id" value={b.id} />
                <label>
                  Technik
                  <select name="technicianId" defaultValue={b.technicianId ?? ''}>
                    <option value="">Nepřiřazeno</option>
                    {people.filter((p) => p.role !== 'REFERENT').map((p) => (
                      <option key={p.id} value={p.id}>
                        {displayName(p)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Referent
                  <select name="referentId" defaultValue={b.referentId ?? ''}>
                    <option value="">Nepřiřazeno</option>
                    {people.filter((p) => p.role !== 'TECHNIK').map((p) => (
                      <option key={p.id} value={p.id}>
                        {displayName(p)}
                      </option>
                    ))}
                  </select>
                </label>
              </ActionForm>
            </details>
          )}
        </section>
        {b.notes && (
          <section className="panel">
            <header>
              <h2>Poznámka</h2>
            </header>
            <p className="notes">{b.notes}</p>
          </section>
        )}
        <div className="grid2">
          <Panel title="Úkoly" count={b.tasks.length} action={<AddTask buildings={[]} buildingId={b.id} people={people} />}>
            {b.tasks.length ? (
              b.tasks.map((t) => <TaskItem key={t.id} t={t} href={`/tasks?b=${b.id}&s=team&t=${t.id}`} showBuilding={false} showStatus />)
            ) : (
              <Empty>Žádné úkoly.</Empty>
            )}
          </Panel>
          <Panel title="Klíče" count={b.keys.length} action={<AddKey buildings={[]} buildingId={b.id} />}>
            {b.keys.length ? b.keys.map((k) => <KeyRow key={k.id} k={k} showBuilding={false} />) : <Empty>Žádné svazky klíčů.</Empty>}
          </Panel>
        </div>
        <Panel title="Protokoly kontrol" count={b.reports.length}>
          <StartReport buildings={[]} buildingId={b.id} />
          {b.reports.map((r) => (
            <ReportRow key={r.id} r={r} showBuilding={false} />
          ))}
        </Panel>
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
