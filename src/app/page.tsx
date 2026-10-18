import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { Empty, InspectionRow, KeyRow, Panel, TaskRow } from '@/components/ui';
import { daysUntil, isOverdue, latestPerType, longToday } from '@/lib/format';

export const dynamic = 'force-dynamic';

const bsel = { select: { id: true, name: true } } as const;

export default async function Home() {
  const [buildings, tasks, keys, inspections] = await Promise.all([
    prisma.building.count(),
    prisma.task.findMany({ where: { status: { not: 'DONE' } }, include: { building: bsel } }),
    prisma.keySet.findMany({ include: { building: bsel } }),
    prisma.inspection.findMany({ include: { building: bsel } }),
  ]);

  const overdue = tasks.filter(isOverdue);
  const upcoming = [...tasks]
    .sort(
      (a, b) =>
        Number(isOverdue(b)) - Number(isOverdue(a)) ||
        (a.dueAt?.getTime() ?? Infinity) - (b.dueAt?.getTime() ?? Infinity),
    )
    .slice(0, 7);
  const lent = keys.filter((k) => k.holder).sort((a, b) => (a.borrowedAt?.getTime() ?? 0) - (b.borrowedAt?.getTime() ?? 0));
  const latest = latestPerType(inspections);
  const soon = latest
    .filter((x) => x.nextDue && daysUntil(x.nextDue) <= 30)
    .sort((a, b) => a.nextDue!.getTime() - b.nextDue!.getTime());
  const lateInsp = soon.filter((x) => daysUntil(x.nextDue!) < 0).length;
  const defects = latest.filter((x) => x.result === 'DEFECT').length;

  return (
    <>
      <div className="head">
        <div>
          <h1>Přehled technika</h1>
          <p className="muted cap">{longToday()}</p>
        </div>
      </div>

      <div className="stats">
        <Link className="stat" href="/buildings">
          <span>Objekty</span>
          <b>{buildings}</b>
          <em>ve správě</em>
        </Link>
        <Link className="stat" href="/tasks">
          <span>Otevřené úkoly</span>
          <b>{tasks.length}</b>
          <em className={overdue.length ? 'alert' : ''}>{overdue.length ? `${overdue.length} po termínu` : 'vše v termínu'}</em>
        </Link>
        <Link className="stat" href="/keys">
          <span>Svazky klíčů</span>
          <b>{keys.length}</b>
          <em>{lent.length} zapůjčeno</em>
        </Link>
        <Link className="stat" href="/inspections">
          <span>Kontroly do 30 dní</span>
          <b>{soon.length}</b>
          <em className={lateInsp ? 'alert' : ''}>
            {lateInsp ? `${lateInsp} po termínu` : defects ? `${defects} se závadou` : 'bez závad'}
          </em>
        </Link>
      </div>

      <div className="grid2">
        <Panel title="Úkoly k řešení" action={<Link href="/tasks" className="more">Všechny →</Link>}>
          {upcoming.length ? upcoming.map((t) => <TaskRow key={t.id} t={t} />) : <Empty>Žádné otevřené úkoly.</Empty>}
        </Panel>
        <div className="stack">
          <Panel title="Blížící se kontroly" action={<Link href="/inspections" className="more">Plán →</Link>}>
            {soon.length ? (
              soon.slice(0, 6).map((x) => <InspectionRow key={x.id} x={x} />)
            ) : (
              <Empty>Žádná kontrola v příštích 30 dnech.</Empty>
            )}
          </Panel>
          <Panel title="Zapůjčené klíče" count={lent.length}>
            {lent.length ? lent.map((k) => <KeyRow key={k.id} k={k} />) : <Empty>Všechny klíče jsou v kanceláři.</Empty>}
          </Panel>
        </div>
      </div>
    </>
  );
}
