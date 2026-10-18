import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getUser } from '@/lib/auth';
import { TicketHead, TicketRow, ticketInclude } from '@/components/ticket-row';
import { CATEGORIES, OPEN_STATUSES } from '@/lib/tickets';

export const dynamic = 'force-dynamic';

const TABS = [
  { key: 'open', label: 'Otevřená' },
  { key: 'havarie', label: 'Havárie' },
  { key: 'mine', label: 'Moje' },
  { key: 'new', label: 'Nová' },
  { key: 'done', label: 'Vyřešená' },
] as const;
type Tab = (typeof TABS)[number]['key'];

export default async function Tickets({ searchParams }: { searchParams: Promise<{ f?: string; b?: string; c?: string; q?: string }> }) {
  const me = (await getUser())!;
  const sp = await searchParams;
  const tab: Tab = TABS.some((t) => t.key === sp.f) ? (sp.f as Tab) : 'open';
  const open: Prisma.TicketWhereInput = { status: { in: OPEN_STATUSES } };
  const byTab: Record<Tab, Prisma.TicketWhereInput> = {
    open,
    havarie: { ...open, urgency: 'HAVARIE' },
    mine: { ...open, assigneeId: me.id },
    new: { status: 'NOVE' },
    done: { status: { in: ['VYRESENO', 'ZAMITNUTO'] } },
  };
  const q = (sp.q ?? '').trim();
  const where: Prisma.TicketWhereInput = {
    AND: [
      byTab[tab],
      sp.b ? { buildingId: sp.b } : {},
      sp.c ? { category: sp.c } : {},
      q ? { OR: [{ title: { contains: q, mode: 'insensitive' } }, { reporterName: { contains: q, mode: 'insensitive' } }, { unitLabel: { contains: q, mode: 'insensitive' } }] } : {},
    ],
  };
  const [tickets, buildings, counts] = await Promise.all([
    prisma.ticket.findMany({
      where,
      include: ticketInclude,
      orderBy: tab === 'done' ? [{ resolvedAt: 'desc' }] : [{ urgency: 'asc' }, { dueAt: 'asc' }],
      take: 200,
    }),
    prisma.building.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    Promise.all(TABS.map((t) => prisma.ticket.count({ where: byTab[t.key] }))),
  ]);
  const link = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ f: tab === 'open' ? undefined : tab, b: sp.b, c: sp.c, q: q || undefined, ...over })) if (v) p.set(k, v);
    const s = p.toString();
    return '/tickets' + (s ? '?' + s : '');
  };

  return (
    <>
      <div className="head">
        <div>
          <h1>Hlášení závad</h1>
          <p className="muted">Požadavky od obyvatel a z kontrol. Lhůta podle naléhavosti: havárie 24 h, vysoká 3 dny, běžná 14 dní.</p>
        </div>
        <div className="head-act">
          <Link href="/tickets/new" className="btn pri">
            + Nové hlášení
          </Link>
        </div>
      </div>
      <div className="tbar">
        <div className="filters scroll">
          {TABS.map((t, i) => (
            <Link key={t.key} href={link({ f: t.key === 'open' ? undefined : t.key })} className={'chip' + (t.key === 'havarie' && counts[i] ? ' hchip bad' : '')} aria-current={tab === t.key ? 'true' : undefined}>
              {t.label}
              {t.key !== 'done' && <span className="cnt">{counts[i]}</span>}
            </Link>
          ))}
        </div>
        <form className="tbar-b" action="/tickets">
          {tab !== 'open' && <input type="hidden" name="f" value={tab} />}
          <input name="q" type="search" defaultValue={q} placeholder="Hledat…" aria-label="Hledat hlášení" className="mini" />
          <select name="b" defaultValue={sp.b ?? ''} aria-label="Dům" className="mini">
            <option value="">Všechny domy</option>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <select name="c" defaultValue={sp.c ?? ''} aria-label="Kategorie" className="mini">
            <option value="">Všechny kategorie</option>
            {Object.entries(CATEGORIES).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
          <button className="btn sm">Filtrovat</button>
        </form>
      </div>
      <section className="xlist">
        <TicketHead />
        {tickets.map((t) => (
          <TicketRow key={t.id} t={t} />
        ))}
        {tickets.length === 0 && <div className="empty">Žádná hlášení. {tab === 'open' && <Link href="/tickets/new">Zapsat nové →</Link>}</div>}
      </section>
    </>
  );
}
