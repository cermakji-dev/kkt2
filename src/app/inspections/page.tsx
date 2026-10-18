import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getUser } from '@/lib/auth';
import { Empty, InspectionRow, Panel } from '@/components/ui';
import { AddInspection } from '@/components/add-forms';
import { StartReport } from '@/components/start-report';
import { ReportRow, reportInclude } from '@/components/report-list';
import { daysUntil, fmtDate, latestPerType } from '@/lib/format';
import { REVISIONS, revisionMatrix, STATE_META } from '@/lib/revisions';

export const dynamic = 'force-dynamic';

const TABS = [
  { key: 'protokoly', label: 'Protokoly' },
  { key: 'matice', label: 'Revize všech domů' },
  { key: 'plan', label: 'Plán revizí' },
  { key: 'historie', label: 'Historie' },
] as const;
type Tab = (typeof TABS)[number]['key'];

export default async function Inspections({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const me = (await getUser())!;
  const { tab: raw } = await searchParams;
  const tab: Tab = TABS.some((t) => t.key === raw) ? (raw as Tab) : 'protokoly';
  const [all, buildings, drafts, finals] = await Promise.all([
    prisma.inspection.findMany({ include: { building: { select: { id: true, name: true } } }, orderBy: { inspectedAt: 'desc' } }),
    prisma.building.findMany({
      select: { id: true, name: true, technicianId: true, referentId: true, hasElevator: true, hasGas: true, hasBoiler: true, hasChimney: true, hasHydrants: true },
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
      take: 30,
    }),
  ]);
  const plan = latestPerType(all).sort((a, b) => (a.nextDue?.getTime() ?? Infinity) - (b.nextDue?.getTime() ?? Infinity));
  const late = plan.filter((x) => x.nextDue && daysUntil(x.nextDue) < 0);
  const soon = plan.filter((x) => x.nextDue && daysUntil(x.nextDue) >= 0 && daysUntil(x.nextDue) <= 30);
  const later = plan.filter((x) => !x.nextDue || daysUntil(x.nextDue) > 30);
  const mine = buildings.filter((b) => b.technicianId === me.id || b.referentId === me.id);
  const sorted = [...mine, ...buildings.filter((b) => !mine.includes(b))];
  const matrix = buildings.map((b) => ({ b, cells: revisionMatrix(b, all.filter((i) => i.buildingId === b.id)) }));
  const problems = matrix.reduce((n, r) => n + r.cells.filter((c) => c.state === 'late' || c.state === 'missing').length, 0);
  const count: Record<Tab, number> = { protokoly: drafts.length, matice: problems, plan: late.length + soon.length, historie: all.length };

  return (
    <>
      <div className="head">
        <div>
          <h1>Kontroly</h1>
          <p className="muted">
            {late.length ? <span className="bad-t">{late.length} po termínu</span> : 'Nic po termínu'} · {soon.length} do 30 dní · {drafts.length} rozpracovaných protokolů
          </p>
        </div>
      </div>

      <section className="panel start-panel hero-start">
        <header>
          <h2>Začít kontrolu v terénu</h2>
          <span className="muted small">Vyber dům a druh protokolu, pak už jen odklikáváš.</span>
        </header>
        <StartReport buildings={sorted} />
      </section>

      <nav className="tabs" aria-label="Části modulu Kontroly">
        {TABS.map((t) => (
          <Link key={t.key} href={t.key === 'protokoly' ? '/inspections' : `/inspections?tab=${t.key}`} aria-current={tab === t.key ? 'page' : undefined} scroll={false}>
            {t.label}
            {count[t.key] ? <span className="cnt">{count[t.key]}</span> : null}
          </Link>
        ))}
      </nav>

      {tab === 'protokoly' && (
        <div className="stack">
          {drafts.length > 0 && (
            <Panel title="Rozpracované" count={drafts.length}>
              {drafts.map((r) => (
                <ReportRow key={r.id} r={r} />
              ))}
            </Panel>
          )}
          <Panel title="Dokončené protokoly" count={finals.length}>
            {finals.length ? finals.map((r) => <ReportRow key={r.id} r={r} />) : <Empty>Zatím žádný dokončený protokol.</Empty>}
          </Panel>
        </div>
      )}

      {tab === 'matice' && (
        <section className="panel">
          <header>
            <h2>Zákonné revize podle domů</h2>
            <span className="legend">
              {(['late', 'soon', 'missing', 'ok'] as const).map((k) => (
                <span key={k} className={'lg ' + STATE_META[k].tone}>
                  {STATE_META[k].label}
                </span>
              ))}
            </span>
          </header>
          <div className="tscroll">
            <table className="dtable matrix">
              <thead>
                <tr>
                  <th>Dům</th>
                  {REVISIONS.map((r) => (
                    <th key={r.key} title={`${r.label} – ${r.law}`}>
                      <span className="vth">{r.label.replace('Revize ', '').replace('Kontrola ', '')}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.map(({ b, cells }) => (
                  <tr key={b.id}>
                    <td>
                      <Link href={`/buildings/${b.id}?tab=kontroly`} className="blink">
                        {b.name}
                      </Link>
                    </td>
                    {cells.map((c) => (
                      <td key={c.rev.key} className={'mc ' + STATE_META[c.state].tone} title={`${c.rev.label}: ${STATE_META[c.state].label}${c.nextDue ? ' · ' + fmtDate(c.nextDue) : ''}`}>
                        {c.state === 'na' ? '' : c.state === 'missing' ? '?' : c.nextDue ? fmtDate(c.nextDue).replace(/\. 20(\d\d)$/, '. $1') : ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'plan' && (
        <div className="stack">
          {late.length > 0 && (
            <Panel title="Po termínu" count={late.length}>
              {late.map((x) => (
                <InspectionRow key={x.id} x={x} />
              ))}
            </Panel>
          )}
          <Panel title="Do 30 dní" count={soon.length} action={<AddInspection buildings={buildings} />}>
            {soon.length ? soon.map((x) => <InspectionRow key={x.id} x={x} />) : <Empty>V příštích 30 dnech nic.</Empty>}
          </Panel>
          <Panel title="Později" count={later.length}>
            {later.length ? later.map((x) => <InspectionRow key={x.id} x={x} />) : <Empty>Nic dalšího v plánu.</Empty>}
          </Panel>
        </div>
      )}

      {tab === 'historie' && (
        <Panel title="Všechny záznamy" count={all.length}>
          {all.length ? all.map((x) => <InspectionRow key={x.id} x={x} canDelete={me.role === 'ADMIN'} />) : <Empty>Historie je prázdná.</Empty>}
        </Panel>
      )}
    </>
  );
}
