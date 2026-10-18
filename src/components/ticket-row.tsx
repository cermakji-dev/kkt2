import Link from 'next/link';
import type { Ticket } from '@prisma/client';
import { CATEGORIES, slaLabel, STATUS, URGENCY } from '@/lib/tickets';
import { ago } from '@/lib/format';
import { initials } from '@/lib/auth';

type T = Ticket & {
  building?: { id: string; name: string } | null;
  assignee?: { name: string | null; email: string } | null;
  supplier?: { name: string } | null;
};

export const ticketInclude = {
  building: { select: { id: true, name: true } },
  assignee: { select: { name: true, email: true } },
  supplier: { select: { name: true } },
} as const;

export function TicketHead({ showBuilding = true }: { showBuilding?: boolean }) {
  return (
    <div className="xhead" aria-hidden="true">
      <span>Č.</span>
      <span>Hlášení</span>
      {showBuilding && <span>Dům</span>}
      <span>Stav</span>
      <span>Řeší</span>
      <span>Lhůta</span>
    </div>
  );
}

export function TicketRow({ t, showBuilding = true }: { t: T; showBuilding?: boolean }) {
  const st = STATUS[t.status];
  const ur = URGENCY[t.urgency];
  const sla = slaLabel(t.dueAt, st.open);
  return (
    <Link href={`/tickets/${t.id}`} className={'xrow' + (t.urgency === 'HAVARIE' && st.open ? ' hav' : '') + (st.open ? '' : ' closed')}>
      <span className="x-no mono">#{t.number}</span>
      <span className="x-main">
        <span className="x-t">
          {t.urgency !== 'BEZNA' && <span className={'flag ' + ur.tone}>{ur.label}</span>}
          <span className="tt">{t.title}</span>
        </span>
        <span className="x-s">
          {CATEGORIES[t.category] ?? t.category}
          {t.unitLabel && ` · ${t.unitLabel}`}
          {t.reporterName && ` · ${t.reporterName}`} · {ago(t.createdAt)}
        </span>
      </span>
      {showBuilding && <span className="x-bld">{t.building && <span className="chip-s">{t.building.name}</span>}</span>}
      <span className="x-st">
        <span className={'pill ' + st.tone}>{st.label}</span>
        {t.supplier && <span className="x-sup">{t.supplier.name}</span>}
      </span>
      <span className="x-who">{t.assignee ? <span className="avatar xs">{initials(t.assignee)}</span> : <span className="avatar xs empty">?</span>}</span>
      <span className={'x-sla due ' + sla.tone}>{sla.text}</span>
    </Link>
  );
}
