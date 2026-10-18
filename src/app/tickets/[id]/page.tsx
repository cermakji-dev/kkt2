import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { displayName, initials } from '@/lib/auth';
import { activePeople } from '@/lib/people';
import { ActionForm, FieldSelect } from '@/components/forms';
import { addTicketComment, setTicketStatus, ticketToTask, updateTicketField } from '../actions';
import { CATEGORIES, CHANNEL, slaLabel, STATUS, URGENCY } from '@/lib/tickets';
import { ago, fmtDateTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

const NEXT: Record<string, { status: string; label: string; pri?: boolean }[]> = {
  NOVE: [
    { status: 'PRIJATO', label: 'Přijmout', pri: true },
    { status: 'RESI_SE', label: 'Řeším sám' },
    { status: 'ZAMITNUTO', label: 'Zamítnout' },
  ],
  PRIJATO: [
    { status: 'RESI_SE', label: 'Začít řešit', pri: true },
    { status: 'VYRESENO', label: 'Vyřešeno' },
  ],
  PREDANO: [
    { status: 'RESI_SE', label: 'Firma řeší' },
    { status: 'VYRESENO', label: 'Vyřešeno', pri: true },
  ],
  RESI_SE: [{ status: 'VYRESENO', label: 'Vyřešeno', pri: true }],
  VYRESENO: [{ status: 'PRIJATO', label: 'Znovu otevřít' }],
  ZAMITNUTO: [{ status: 'NOVE', label: 'Znovu otevřít' }],
};

export default async function TicketDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const person = { select: { id: true, name: true, email: true, phone: true } } as const;
  const [t, people, suppliers] = await Promise.all([
    prisma.ticket.findUnique({
      where: { id },
      include: {
        building: { select: { id: true, name: true, address: true } },
        assignee: person,
        createdBy: person,
        supplier: true,
        task: { select: { id: true, title: true, status: true } },
        events: { orderBy: { createdAt: 'asc' }, include: { author: person } },
      },
    }),
    activePeople(),
    prisma.supplier.findMany({ where: { active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true, category: true } }),
  ]);
  if (!t) notFound();
  const st = STATUS[t.status];
  const ur = URGENCY[t.urgency];
  const sla = slaLabel(t.dueAt, st.open);

  return (
    <>
      <Link href="/tickets" className="back">
        ← Hlášení závad
      </Link>
      <div className="head">
        <div>
          <div className="bc-top">
            <span className="mono muted">#{t.number}</span>
            <span className={'pill ' + st.tone}>{st.label}</span>
            {t.urgency !== 'BEZNA' && <span className={'flag ' + ur.tone}>{ur.label}</span>}
            {sla.text && <span className={'due ' + sla.tone}>{sla.text}</span>}
          </div>
          <h1>{t.title}</h1>
          <div className="meta">
            <Link href={`/buildings/${t.building.id}?tab=zavady`} className="blink">
              {t.building.name}
            </Link>
            {t.unitLabel && <span>{t.unitLabel}</span>}
            <span>{CATEGORIES[t.category] ?? t.category}</span>
            <span>nahlášeno {fmtDateTime(t.createdAt)}</span>
          </div>
        </div>
        <div className="head-act">
          {NEXT[t.status].map((n) => (
            <form key={n.status} action={setTicketStatus}>
              <input type="hidden" name="id" value={t.id} />
              <input type="hidden" name="status" value={n.status} />
              <button className={'btn' + (n.pri ? ' pri' : '')}>{n.label}</button>
            </form>
          ))}
        </div>
      </div>

      <div className="detail2">
        <div className="stack">
          {t.description && (
            <section className="panel">
              <header>
                <h2>Popis</h2>
              </header>
              <p className="notes">{t.description}</p>
            </section>
          )}
          <section className="panel">
            <header>
              <h2>Průběh</h2>
            </header>
            <ol className="tl">
              {t.events.map((e) => (
                <li key={e.id} className={e.kind === 'STATUS' ? 'sys' : ''}>
                  <span className="avatar xs">{e.author ? initials(e.author) : '·'}</span>
                  <div>
                    <div className="tl-h">
                      <b>{displayName(e.author)}</b>
                      <span className="muted small" title={fmtDateTime(e.createdAt)}>
                        {ago(e.createdAt)}
                      </span>
                    </div>
                    <p>{e.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <ActionForm action={addTicketComment} submitLabel="Přidat poznámku" className="add commentform pad" successText="Přidáno" resetOnSuccess>
              <input type="hidden" name="ticketId" value={t.id} />
              <label className="wide">
                <textarea name="body" rows={2} required maxLength={4000} placeholder="Co se udělalo, s kým se mluvilo…" aria-label="Poznámka" />
              </label>
            </ActionForm>
          </section>
        </div>

        <aside className="stack">
          <section className="panel">
            <header>
              <h2>Řešení</h2>
            </header>
            <dl className="tprops pad">
              <dt>Řeší</dt>
              <dd>
                <FieldSelect
                  action={updateTicketField}
                  id={t.id}
                  field="assigneeId"
                  value={t.assigneeId ?? ''}
                  label="Řeší"
                  options={[{ value: '', label: 'Nikdo' }, ...people.map((p) => ({ value: p.id, label: displayName(p) }))]}
                />
              </dd>
              <dt>Firma</dt>
              <dd>
                <FieldSelect
                  action={updateTicketField}
                  id={t.id}
                  field="supplierId"
                  value={t.supplierId ?? ''}
                  label="Firma"
                  options={[{ value: '', label: 'Bez firmy' }, ...suppliers.map((s) => ({ value: s.id, label: s.name }))]}
                />
              </dd>
              <dt>Naléhavost</dt>
              <dd>
                <FieldSelect
                  action={updateTicketField}
                  id={t.id}
                  field="urgency"
                  value={t.urgency}
                  label="Naléhavost"
                  options={Object.entries(URGENCY).map(([k, v]) => ({ value: k, label: v.label }))}
                />
              </dd>
              <dt>Kategorie</dt>
              <dd>
                <FieldSelect
                  action={updateTicketField}
                  id={t.id}
                  field="category"
                  value={t.category}
                  label="Kategorie"
                  options={Object.entries(CATEGORIES).map(([k, v]) => ({ value: k, label: v }))}
                />
              </dd>
              <dt>Lhůta</dt>
              <dd className="pv">{fmtDateTime(t.dueAt)}</dd>
              {t.resolvedAt && (
                <>
                  <dt>Uzavřeno</dt>
                  <dd className="pv">{fmtDateTime(t.resolvedAt)}</dd>
                </>
              )}
            </dl>
            <div className="pad-b">
              {t.task ? (
                <Link href={`/tasks?s=team&t=${t.task.id}`} className="btn sm">
                  Úkol: {t.task.status === 'DONE' ? 'hotovo ✓' : 'otevřít'} →
                </Link>
              ) : (
                <form action={ticketToTask}>
                  <input type="hidden" name="id" value={t.id} />
                  <button className="btn sm">Vytvořit úkol</button>
                </form>
              )}
            </div>
          </section>
          {t.supplier && (
            <section className="panel">
              <header>
                <h2>{t.supplier.name}</h2>
                <Link href={`/suppliers/${t.supplier.id}`} className="more">
                  Karta firmy →
                </Link>
              </header>
              <div className="pad contact-lines">
                {t.supplier.emergencyPhone && (
                  <a href={`tel:${t.supplier.emergencyPhone.replace(/\s/g, '')}`} className="callbtn bad">
                    Havarijní linka {t.supplier.emergencyPhone}
                  </a>
                )}
                {t.supplier.phone && (
                  <a href={`tel:${t.supplier.phone.replace(/\s/g, '')}`} className="callbtn">
                    {t.supplier.contactName ?? 'Telefon'} {t.supplier.phone}
                  </a>
                )}
                {t.supplier.email && <span className="muted small">{t.supplier.email}</span>}
              </div>
            </section>
          )}
          <section className="panel">
            <header>
              <h2>Kdo hlásil</h2>
            </header>
            <div className="pad contact-lines">
              <b>{t.reporterName ?? 'Neuvedeno'}</b>
              {t.reporterPhone && (
                <a href={`tel:${t.reporterPhone.replace(/\s/g, '')}`} className="callbtn">
                  Zavolat {t.reporterPhone}
                </a>
              )}
              {t.reporterEmail && <span className="muted small">{t.reporterEmail}</span>}
              <span className="muted small">
                {CHANNEL[t.channel]} · zapsal {displayName(t.createdBy)}
              </span>
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}
