import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getUser } from '@/lib/auth';
import { Empty, InspectionRow, KeyRow, Panel } from '@/components/ui';
import { TaskItem, taskItemInclude } from '@/components/task-item';
import { TicketRow, ticketInclude } from '@/components/ticket-row';
import { daysUntil, isOverdue, latestPerType, longToday } from '@/lib/format';
import { OPEN_STATUSES } from '@/lib/tickets';
import { contractState } from '@/lib/suppliers';

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
  const scope = myBuildingIds.length ? { buildingId: { in: myBuildingIds } } : {};

  const [myTasks, unassigned, keys, inspections, tickets, contracts] = await Promise.all([
    prisma.task.findMany({ where: { status: { not: 'DONE' }, assigneeId: me.id, parentId: null }, include: taskItemInclude }),
    prisma.task.count({ where: { status: { not: 'DONE' }, assigneeId: null, parentId: null } }),
    prisma.keySet.findMany({ where: { holder: { not: null } }, include: { building: bsel, loans: { where: { returnedAt: null }, select: { expectedReturn: true, purpose: true }, take: 1 } } }),
    prisma.inspection.findMany({ where: scope, include: { building: bsel } }),
    prisma.ticket.findMany({ where: { status: { in: OPEN_STATUSES }, ...scope }, include: ticketInclude, orderBy: [{ urgency: 'asc' }, { dueAt: 'asc' }] }),
    me.role === 'ADMIN' ? prisma.contract.findMany({ select: { validTo: true, noticeDays: true, autoRenew: true } }) : Promise.resolve([]),
  ]);

  const overdue = myTasks.filter(isOverdue);
  const upcoming = [...myTasks]
    .sort((a, b) => Number(isOverdue(b)) - Number(isOverdue(a)) || (a.dueAt?.getTime() ?? Infinity) - (b.dueAt?.getTime() ?? Infinity))
    .slice(0, 8);
  const lent = keys.sort((a, b) => (a.borrowedAt?.getTime() ?? 0) - (b.borrowedAt?.getTime() ?? 0));
  const lateKeys = lent.filter((k) => k.loans[0]?.expectedReturn && daysUntil(k.loans[0].expectedReturn) < 0).length;
  const latest = latestPerType(inspections);
  const soon = latest.filter((x) => x.nextDue && daysUntil(x.nextDue) <= 30).sort((a, b) => a.nextDue!.getTime() - b.nextDue!.getTime());
  const lateInsp = soon.filter((x) => daysUntil(x.nextDue!) < 0).length;
  const havarie = tickets.filter((t) => t.urgency === 'HAVARIE');
  const fresh = tickets.filter((t) => t.status === 'NOVE').length;
  const contractsWarn = contracts.filter((c) => ['warn', 'bad'].includes(contractState(c).tone)).length;
  const where = myBuildingIds.length ? 'v mých domech' : 've všech domech';

  return (
    <>
      <div className="head">
        <div>
          <p className="muted cap eyebrow">{longToday()}</p>
          <h1>{greeting()}</h1>
        </div>
        <div className="head-act">
          <Link href="/tickets/new" className="btn">
            + Nahlásit závadu
          </Link>
          <Link href="/inspections" className="btn pri">
            Začít kontrolu
          </Link>
        </div>
      </div>

      {havarie.length > 0 && (
        <Link href="/tickets?f=havarie" className="alertbar">
          <b>
            {havarie.length} {havarie.length === 1 ? 'havárie' : 'havárie'} k řešení
          </b>
          <span>{havarie.map((t) => `${t.building?.name}: ${t.title}`).join(' · ')}</span>
          <span className="go">Otevřít →</span>
        </Link>
      )}

      <div className="stats">
        <Link className={'stat' + (overdue.length ? ' hot' : '')} href="/tasks">
          <span>Moje úkoly</span>
          <b>{myTasks.length}</b>
          <em className={overdue.length ? 'alert' : ''}>{overdue.length ? `${overdue.length} po termínu` : 'vše v termínu'}</em>
        </Link>
        <Link className={'stat' + (havarie.length ? ' hot' : '')} href="/tickets">
          <span>{myBuildingIds.length ? 'Závady v mých domech' : 'Otevřené závady'}</span>
          <b>{tickets.length}</b>
          <em className={havarie.length ? 'alert' : ''}>{havarie.length ? `${havarie.length} havárie` : fresh ? `${fresh} nových` : where}</em>
        </Link>
        <Link className={'stat' + (lateInsp ? ' hot' : '')} href="/inspections?tab=plan">
          <span>Revize do 30 dní</span>
          <b>{soon.length}</b>
          <em className={lateInsp ? 'alert' : ''}>{lateInsp ? `${lateInsp} po termínu` : where}</em>
        </Link>
        <Link className={'stat' + (lateKeys ? ' hot' : '')} href="/keys">
          <span>Klíče venku</span>
          <b>{lent.length}</b>
          <em className={lateKeys ? 'alert' : ''}>{lateKeys ? `${lateKeys} nevráceno včas` : unassigned ? `${unassigned} úkolů bez řešitele` : 'vše v pořádku'}</em>
        </Link>
      </div>
      {contractsWarn > 0 && (
        <Link href="/suppliers?tab=smlouvy" className="banner">
          {contractsWarn} {contractsWarn === 1 ? 'smlouva vyžaduje' : 'smlouvy vyžadují'} pozornost (výpovědní lhůta nebo konec platnosti) →
        </Link>
      )}

      <div className="grid2 wide3">
        <Panel title="Moje úkoly" count={myTasks.length} action={<Link href="/tasks" className="more">Všechny →</Link>}>
          {upcoming.length ? (
            upcoming.map((t) => <TaskItem key={t.id} t={t} href={`/tasks?t=${t.id}`} />)
          ) : (
            <Empty>Žádné otevřené úkoly. {unassigned > 0 && <Link href="/tasks?s=unassigned">Převzít nepřiřazené →</Link>}</Empty>
          )}
        </Panel>
        <Panel title="Závady k řešení" count={tickets.length} action={<Link href="/tickets" className="more">Všechny →</Link>}>
          {tickets.length ? tickets.slice(0, 7).map((t) => <TicketRow key={t.id} t={t} />) : <Empty>Žádná otevřená hlášení.</Empty>}
        </Panel>
        <div className="stack">
          <Panel title="Blížící se revize" action={<Link href="/inspections?tab=plan" className="more">Plán →</Link>}>
            {soon.length ? soon.slice(0, 6).map((x) => <InspectionRow key={x.id} x={x} />) : <Empty>Žádná revize v příštích 30 dnech.</Empty>}
          </Panel>
          <Panel title="Klíče venku" count={lent.length}>
            {lent.length ? lent.slice(0, 6).map((k) => <KeyRow key={k.id} k={k} loan={k.loans[0]} />) : <Empty>Všechny klíče jsou v kanceláři.</Empty>}
          </Panel>
        </div>
      </div>
    </>
  );
}
