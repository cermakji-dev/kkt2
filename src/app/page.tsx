import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getUser } from '@/lib/auth';
import { Empty, InspectionRow, KeyRow, Panel, TaskRow } from '@/components/ui';
import { daysUntil, isOverdue, latestPerType, longToday } from '@/lib/format';

export const dynamic = 'force-dynamic';

const bsel = { select: { id: true, name: true } } as const;

function greeting() {
  const h = Number(new Intl.DateTimeFormat('cs-CZ', { timeZone: 'Europe/Prague', hour: 'numeric', hour12: false }).format(new Date()));
  return h < 10 ? 'Dobré ráno' : h < 18 ? 'Dobrý den' : 'Dobrý večer';
}

export default async function Home() {
  const me = (await getUser())!;
  const mineWhere = { OR: [{ technicianId: me.id }, { referentId: me.id }] };
  const myBuildingIds = (await prisma.building.findMany({ where: mineWhere, select: { id: true } })).map((b) => b.id);
  // Bez přiřazených objektů (typicky admin) ukazujeme celý dům.
  const scope = myBuildingIds.length ? { buildingId: { in: myBuildingIds } } : {};

  const [buildings, myTasks, unassigned, keys, inspections] = await Promise.all([
    prisma.building.count(),
    prisma.task.findMany({ where: { status: { not: 'DONE' }, assigneeId: me.id }, include: { building: bsel } }),
    prisma.task.count({ where: { status: { not: 'DONE' }, assigneeId: null } }),
    prisma.keySet.findMany({ where: { holder: { not: null } }, include: { building: bsel } }),
    prisma.inspection.findMany({ where: scope, include: { building: bsel } }),
  ]);

  const overdue = myTasks.filter(isOverdue);
  const upcoming = [...myTasks]
    .sort(
      (a, b) =>
        Number(isOverdue(b)) - Number(isOverdue(a)) ||
        (a.dueAt?.getTime() ?? Infinity) - (b.dueAt?.getTime() ?? Infinity),
    )
    .slice(0, 7);
  const lent = keys.sort((a, b) => (a.borrowedAt?.getTime() ?? 0) - (b.borrowedAt?.getTime() ?? 0));
  const longLent = lent.filter((k) => k.borrowedAt && daysUntil(k.borrowedAt) <= -7).length;
  const latest = latestPerType(inspections);
  const soon = latest
    .filter((x) => x.nextDue && daysUntil(x.nextDue) <= 30)
    .sort((a, b) => a.nextDue!.getTime() - b.nextDue!.getTime());
  const lateInsp = soon.filter((x) => daysUntil(x.nextDue!) < 0).length;

  return (
    <>
      <div className="head">
        <div>
          <p className="muted cap eyebrow">{longToday()}</p>
          <h1>{greeting()}</h1>
        </div>
      </div>

      <div className="stats">
        <Link className={'stat' + (overdue.length ? ' hot' : '')} href="/tasks">
          <span>Moje úkoly</span>
          <b>{myTasks.length}</b>
          <em className={overdue.length ? 'alert' : ''}>{overdue.length ? `${overdue.length} po termínu` : 'vše v termínu'}</em>
        </Link>
        <Link className={'stat' + (lateInsp ? ' hot' : '')} href="/inspections">
          <span>Kontroly do 30 dní</span>
          <b>{soon.length}</b>
          <em className={lateInsp ? 'alert' : ''}>{lateInsp ? `${lateInsp} po termínu` : myBuildingIds.length ? 'v mých objektech' : 've všech objektech'}</em>
        </Link>
        <Link className="stat" href="/keys">
          <span>Klíče venku</span>
          <b>{lent.length}</b>
          <em className={longLent ? 'alert' : ''}>{longLent ? `${longLent} déle než týden` : 'nic dlouho venku'}</em>
        </Link>
        <Link className="stat" href={myBuildingIds.length ? '/buildings?f=mine' : '/buildings'}>
          <span>{myBuildingIds.length ? 'Moje objekty' : 'Objekty'}</span>
          <b>{myBuildingIds.length || buildings}</b>
          <em>{unassigned ? `${unassigned} úkolů bez řešitele` : `z ${buildings} ve správě`}</em>
        </Link>
      </div>

      <div className="grid2">
        <Panel title="Moje úkoly" count={myTasks.length} action={<Link href="/tasks" className="more">Všechny →</Link>}>
          {upcoming.length ? (
            upcoming.map((t) => <TaskRow key={t.id} t={t} />)
          ) : (
            <Empty>Žádné otevřené úkoly. {unassigned > 0 && <Link href="/tasks?f=unassigned">Převzít nepřiřazené →</Link>}</Empty>
          )}
        </Panel>
        <div className="stack">
          <Panel title="Blížící se kontroly" action={<Link href="/inspections" className="more">Plán →</Link>}>
            {soon.length ? (
              soon.slice(0, 6).map((x) => <InspectionRow key={x.id} x={x} />)
            ) : (
              <Empty>Žádná kontrola v příštích 30 dnech.</Empty>
            )}
          </Panel>
          <Panel title="Klíče venku" count={lent.length}>
            {lent.length ? lent.map((k) => <KeyRow key={k.id} k={k} />) : <Empty>Všechny klíče jsou v kanceláři.</Empty>}
          </Panel>
        </div>
      </div>
    </>
  );
}
