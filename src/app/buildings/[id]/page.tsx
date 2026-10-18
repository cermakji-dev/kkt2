import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { Empty, InspectionRow, KeyRow, Panel } from '@/components/ui';
import { AddInspection, AddKey } from '@/components/add-forms';
import { ActionForm, DeleteButton } from '@/components/forms';
import { assignBuilding, deleteBuilding } from '@/app/actions';
import { quickAdd } from '@/app/tasks/actions';
import { latestPerType } from '@/lib/format';
import { displayName, getUser, initials } from '@/lib/auth';
import { activePeople } from '@/lib/people';
import { StartReport } from '@/components/start-report';
import { ReportRow, reportInclude } from '@/components/report-list';
import { TaskHead, TaskItem, taskItemInclude } from '@/components/task-item';
import { QuickAdd } from '@/components/task-client';
import { buildingHealth } from '@/lib/health';
import { sortTasks } from '@/lib/tasks';

export const dynamic = 'force-dynamic';

const TABS = [
  { key: 'prehled', label: 'Přehled' },
  { key: 'ukoly', label: 'Úkoly' },
  { key: 'kontroly', label: 'Kontroly' },
  { key: 'klice', label: 'Klíče' },
] as const;
type Tab = (typeof TABS)[number]['key'];

export default async function BuildingDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params;
  const { tab: rawTab } = await searchParams;
  const tab: Tab = TABS.some((t) => t.key === rawTab) ? (rawTab as Tab) : 'prehled';
  const person = { select: { id: true, name: true, email: true, phone: true } } as const;
  const [me, people, b] = await Promise.all([
    getUser(),
    activePeople(),
    prisma.building.findUnique({
      where: { id },
      include: {
        technician: person,
        referent: person,
        tasks: { where: { parentId: null }, include: taskItemInclude },
        keys: { orderBy: { code: 'asc' }, include: { loans: { where: { returnedAt: null }, select: { expectedReturn: true, purpose: true }, take: 1 } } },
        inspections: { orderBy: { inspectedAt: 'desc' } },
        reports: { include: reportInclude, orderBy: { date: 'desc' }, take: 20 },
      },
    }),
  ]);
  if (!b) notFound();
  const isAdmin = me?.role === 'ADMIN';
  const open = b.tasks.filter((t) => t.status !== 'DONE').sort(sortTasks);
  const done = b.tasks.filter((t) => t.status === 'DONE').sort((x, y) => (y.completedAt?.getTime() ?? 0) - (x.completedAt?.getTime() ?? 0));
  const health = buildingHealth({ tasks: b.tasks, inspections: b.inspections });
  const plan = latestPerType(b.inspections).sort((x, y) => (x.nextDue?.getTime() ?? Infinity) - (y.nextDue?.getTime() ?? Infinity));
  const keysOut = b.keys.filter((k) => k.holder);
  const drafts = b.reports.filter((r) => r.status === 'DRAFT');
  const linked = b.tasks.length + b.keys.length + b.inspections.length + b.reports.length;
  const tabCount: Record<Tab, number | null> = { prehled: null, ukoly: open.length, kontroly: plan.length, klice: b.keys.length };

  return (
    <>
      <Link href="/buildings" className="back">
        ← Objekty
      </Link>
      <div className="bhead">
        <div className="bhead-main">
          <div className="bc-top">
            <span className={'hdot ' + health.tone} aria-hidden="true" />
            <span className={'bc-status ' + health.tone}>{health.label}</span>
          </div>
          <h1>{b.name}</h1>
          <div className="meta">
            <span>{b.address}</span>
            {b.units != null && <span>{b.units} bytových jednotek</span>}
          </div>
        </div>
        <div className="bhead-people">
          {[
            { role: 'Technik', p: b.technician },
            { role: 'Referent', p: b.referent },
          ].map(({ role, p }) => (
            <div key={role} className="bperson">
              <span className={'avatar sm' + (p ? '' : ' empty')}>{p ? initials(p) : '?'}</span>
              <div>
                <span className="lbl">{role}</span>
                <b>{p ? displayName(p) : 'Nepřiřazeno'}</b>
                {p?.phone && (
                  <a href={`tel:${p.phone.replace(/\s/g, '')}`} className="mono small">
                    {p.phone}
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <nav className="tabs" aria-label="Části karty objektu">
        {TABS.map((t) => (
          <Link key={t.key} href={t.key === 'prehled' ? `/buildings/${b.id}` : `/buildings/${b.id}?tab=${t.key}`} aria-current={tab === t.key ? 'page' : undefined} scroll={false}>
            {t.label}
            {tabCount[t.key] ? <span className="cnt">{tabCount[t.key]}</span> : null}
          </Link>
        ))}
      </nav>

      {tab === 'prehled' && (
        <div className="grid2 wide3">
          <div className="stack">
            <section className={'panel healthcard ' + health.tone}>
              <header>
                <h2>Co je potřeba</h2>
              </header>
              <ul className="whylist">
                {health.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
              <div className="quickacts">
                <StartReport buildings={[]} buildingId={b.id} />
              </div>
            </section>
            <Panel title="Nejbližší úkoly" count={open.length} action={<Link href={`?tab=ukoly`} className="more">Všechny →</Link>}>
              {open.length ? (
                open.slice(0, 5).map((t) => <TaskItem key={t.id} t={t} href={`/tasks?b=${b.id}&s=team&t=${t.id}`} showBuilding={false} showStatus />)
              ) : (
                <Empty>Žádné otevřené úkoly.</Empty>
              )}
            </Panel>
          </div>
          <div className="stack">
            <Panel title="Další termíny kontrol" action={<Link href={`?tab=kontroly`} className="more">Plán →</Link>}>
              {plan.length ? plan.slice(0, 5).map((x) => <InspectionRow key={x.id} x={x} showBuilding={false} />) : <Empty>Bez plánu kontrol.</Empty>}
            </Panel>
            <Panel title="Klíče venku" count={keysOut.length}>
              {keysOut.length ? keysOut.map((k) => <KeyRow key={k.id} k={k} loan={k.loans[0]} showBuilding={false} />) : <Empty>Všechny klíče jsou v kanceláři.</Empty>}
            </Panel>
          </div>
          <div className="stack">
            {b.notes && (
              <section className="panel">
                <header>
                  <h2>Poznámky k objektu</h2>
                </header>
                <p className="notes">{b.notes}</p>
              </section>
            )}
            {isAdmin && (
              <details className="panel assign">
                <summary>Správa objektu: přiřazení a smazání</summary>
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
                <div className="danger-zone">
                  {linked ? (
                    <span className="muted small">Objekt má navázané záznamy ({linked}), proto ho nelze smazat.</span>
                  ) : (
                    <DeleteButton action={deleteBuilding} id={b.id} label="Smazat objekt" />
                  )}
                </div>
              </details>
            )}
          </div>
        </div>
      )}

      {tab === 'ukoly' && (
        <>
          <QuickAdd action={quickAdd} placeholder={`Nový úkol pro ${b.name}… (Enter)`} hidden={{ buildingId: b.id, ...(b.technicianId ? { assigneeId: b.technicianId } : {}) }} />
          <section className="tlist no-bld">
            <TaskHead showBuilding={false} />
            {open.length ? open.map((t) => <TaskItem key={t.id} t={t} href={`/tasks?b=${b.id}&s=team&t=${t.id}`} showBuilding={false} showStatus />) : <div className="empty">Žádné otevřené úkoly.</div>}
          </section>
          {done.length > 0 && (
            <section className="tlist no-bld">
              <h3 className="tgroup-h">
                Dokončené<span className="count">{done.length}</span>
              </h3>
              {done.slice(0, 15).map((t) => (
                <TaskItem key={t.id} t={t} href={`/tasks?b=${b.id}&s=done&t=${t.id}`} showBuilding={false} />
              ))}
            </section>
          )}
        </>
      )}

      {tab === 'kontroly' && (
        <div className="stack">
          <section className="panel start-panel">
            <header>
              <h2>Nová kontrola</h2>
            </header>
            <StartReport buildings={[]} buildingId={b.id} />
          </section>
          {drafts.length > 0 && (
            <Panel title="Rozpracované protokoly" count={drafts.length}>
              {drafts.map((r) => (
                <ReportRow key={r.id} r={r} showBuilding={false} />
              ))}
            </Panel>
          )}
          <Panel title="Plán revizí" count={plan.length} action={<AddInspection buildings={[]} buildingId={b.id} />}>
            {plan.length ? plan.map((x) => <InspectionRow key={x.id} x={x} showBuilding={false} />) : <Empty>Zatím žádná kontrola.</Empty>}
          </Panel>
          <Panel title="Protokoly" count={b.reports.length - drafts.length}>
            {b.reports.filter((r) => r.status === 'FINAL').length ? (
              b.reports.filter((r) => r.status === 'FINAL').map((r) => <ReportRow key={r.id} r={r} showBuilding={false} />)
            ) : (
              <Empty>Zatím žádný dokončený protokol.</Empty>
            )}
          </Panel>
          <details className="panel history">
            <summary>
              <h2>
                Historie záznamů<span className="count">{b.inspections.length}</span>
              </h2>
            </summary>
            <div className="rows">
              {b.inspections.map((x) => (
                <InspectionRow key={x.id} x={x} showBuilding={false} />
              ))}
            </div>
          </details>
        </div>
      )}

      {tab === 'klice' && (
        <Panel title="Svazky klíčů" count={b.keys.length} action={<AddKey buildings={[]} buildingId={b.id} />}>
          {b.keys.length ? (
            b.keys.map((k) => <KeyRow key={k.id} k={k} loan={k.loans[0]} showBuilding={false} />)
          ) : (
            <Empty>Žádné svazky klíčů.</Empty>
          )}
        </Panel>
      )}
    </>
  );
}
