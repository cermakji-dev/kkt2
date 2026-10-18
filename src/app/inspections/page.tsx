import { prisma } from '@/lib/prisma';
import { getUser } from '@/lib/auth';
import { Empty, InspectionRow, Panel } from '@/components/ui';
import { AddInspection } from '@/components/add-forms';
import { StartReport } from '@/components/start-report';
import { ReportRow, reportInclude } from '@/components/report-list';
import { latestPerType } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function Inspections() {
  const me = (await getUser())!;
  const [all, buildings, drafts, finals] = await Promise.all([
    prisma.inspection.findMany({
      include: { building: { select: { id: true, name: true } } },
      orderBy: { inspectedAt: 'desc' },
    }),
    prisma.building.findMany({
      select: { id: true, name: true, technicianId: true, referentId: true },
      orderBy: { name: 'asc' },
    }),
    prisma.inspectionReport.findMany({
      where: { status: 'DRAFT' },
      include: { ...reportInclude, building: { select: { id: true, name: true } } },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.inspectionReport.findMany({
      where: { status: 'FINAL' },
      include: { ...reportInclude, building: { select: { id: true, name: true } } },
      orderBy: { finalizedAt: 'desc' },
      take: 10,
    }),
  ]);
  const plan = latestPerType(all).sort(
    (a, b) => (a.nextDue?.getTime() ?? Infinity) - (b.nextDue?.getTime() ?? Infinity),
  );
  // Vlastní objekty nahoru ve výběru.
  const mine = buildings.filter((b) => b.technicianId === me.id || b.referentId === me.id);
  const sorted = [...mine, ...buildings.filter((b) => !mine.includes(b))];

  return (
    <>
      <div className="head">
        <div>
          <h1>Kontroly</h1>
          <p className="muted">Protokoly z prohlídek a plán revizí s termíny.</p>
        </div>
      </div>
      <div className="stack">
        <section className="panel start-panel">
          <header>
            <h2>Nová kontrola v terénu</h2>
          </header>
          <StartReport buildings={sorted} />
        </section>
        {drafts.length > 0 && (
          <Panel title="Rozpracované protokoly" count={drafts.length}>
            {drafts.map((r) => (
              <ReportRow key={r.id} r={r} />
            ))}
          </Panel>
        )}
        <Panel title="Plán revizí a termínů" count={plan.length} action={<AddInspection buildings={buildings} />}>
          {plan.length ? plan.map((x) => <InspectionRow key={x.id} x={x} />) : <Empty>Zatím žádná kontrola.</Empty>}
        </Panel>
        <Panel title="Poslední protokoly" count={finals.length}>
          {finals.length ? finals.map((r) => <ReportRow key={r.id} r={r} />) : <Empty>Zatím žádný dokončený protokol.</Empty>}
        </Panel>
        <details className="panel history">
          <summary>
            <h2>
              Historie všech záznamů<span className="count">{all.length}</span>
            </h2>
          </summary>
          <div className="rows">
            {all.map((x) => (
              <InspectionRow key={x.id} x={x} />
            ))}
          </div>
        </details>
      </div>
    </>
  );
}
