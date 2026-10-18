import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getUser } from '@/lib/auth';
import { Empty, InspectionRow, Panel } from '@/components/ui';
import { AddInspection } from '@/components/add-forms';
import { StartReport } from '@/components/start-report';
import { ReportRow, reportInclude } from '@/components/report-list';
import { daysUntil, latestPerType } from '@/lib/format';

export const dynamic = 'force-dynamic';

const TABS = [
  { key: 'protokoly', label: 'Protokoly' },
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
    prisma.building.findMany({ select: { id: true, name: true, technicianId: true, referentId: true }, orderBy: { name: 'asc' } }),
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
  const count: Record<Tab, number> = { protokoly: drafts.length, plan: late.length + soon.length, historie: all.length };

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
