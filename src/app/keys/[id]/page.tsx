import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { displayName } from '@/lib/auth';
import { ActButton } from '@/components/forms';
import { Pill } from '@/components/ui';
import { returnKey } from '../actions';
import { daysUntil, fmtDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

function fmtTime(d: Date) {
  return new Intl.DateTimeFormat('cs-CZ', { timeZone: 'Europe/Prague', hour: '2-digit', minute: '2-digit' }).format(d);
}
function fmtDT(d: Date | null) {
  if (!d) return '';
  return `${new Intl.DateTimeFormat('cs-CZ', { timeZone: 'Europe/Prague', day: 'numeric', month: 'numeric', year: 'numeric' }).format(d)} ${fmtTime(d)}`;
}

export default async function KeyDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ nova?: string }> }) {
  const { id } = await params;
  const { nova } = await searchParams;
  const person = { select: { name: true, email: true } } as const;
  const k = await prisma.keySet.findUnique({
    where: { id },
    include: {
      building: { select: { id: true, name: true, address: true } },
      loans: { orderBy: { borrowedAt: 'desc' }, include: { issuedBy: person, returnedTo: person, _count: { select: { attachments: true } } } },
    },
  });
  if (!k) notFound();
  const active = k.loans.find((l) => !l.returnedAt);
  const late = active?.expectedReturn && daysUntil(active.expectedReturn) < 0;

  return (
    <>
      <Link href="/keys" className="back">
        ← Klíče
      </Link>
      <div className="head">
        <div>
          <h1>
            <span className="code big">{k.code}</span> {k.description}
          </h1>
          <div className="meta">
            <Link href={`/buildings/${k.building.id}`} className="blink">
              {k.building.name}
            </Link>
            {k.count && <span>{k.count} ks</span>}
            <span>{k.loans.length} výpůjček celkem</span>
          </div>
        </div>
      </div>

      {nova && active?.id === nova && (
        <div className="banner ok">
          Klíče předány. <a href={`/keys/loans/${nova}/pdf`} target="_blank" rel="noopener">Otevřít předávací protokol (PDF) →</a>
        </div>
      )}

      <section className={'panel keystate' + (active ? (late ? ' late' : ' out') : ' home')}>
        {active ? (
          <div className="keystate-in">
            <div>
              <span className="lbl">{late ? 'Po termínu vrácení' : 'Zapůjčeno'}</span>
              <h2>{active.holderCompany || active.holder}</h2>
              <p className="muted">
                {active.holderCompany && <>{active.holder} · </>}
                {active.holderPhone && (
                  <a href={`tel:${active.holderPhone.replace(/\s/g, '')}`} className="mono">
                    {active.holderPhone}
                  </a>
                )}
              </p>
              <p className="muted small">
                Od {fmtDT(active.borrowedAt)}
                {active.expectedReturn && ` · vrátit do ${fmtDate(active.expectedReturn)}`}
                {active.purpose && ` · ${active.purpose}`}
              </p>
            </div>
            <div className="keystate-act">
              <a href={`/keys/loans/${active.id}/pdf`} target="_blank" rel="noopener" className="btn">
                Protokol PDF
              </a>
              <ActButton action={returnKey} id={k.id} className="btn pri">
                Klíče vráceny
              </ActButton>
            </div>
          </div>
        ) : (
          <div className="keystate-in">
            <div>
              <span className="lbl">K dispozici</span>
              <h2>V kanceláři</h2>
            </div>
            <div className="keystate-act">
              <Link href={`/keys/${k.id}/lend`} className="btn pri">
                Zapůjčit klíče
              </Link>
            </div>
          </div>
        )}
      </section>

      <section className="panel">
        <header>
          <h2>
            Historie výpůjček<span className="count">{k.loans.length}</span>
          </h2>
        </header>
        <div className="rows">
          {k.loans.length ? (
            k.loans.map((l) => (
              <div key={l.id} className="row">
                <div className="main">
                  <div className="t">
                    {l.holderCompany ? `${l.holderCompany} · ${l.holder}` : l.holder}
                  </div>
                  <div className="s">
                    <span>
                      {fmtDT(l.borrowedAt)} → {l.returnedAt ? fmtDT(l.returnedAt) : 'dosud nevráceno'}
                    </span>
                    {l.purpose && <span>{l.purpose}</span>}
                    <span>vydal {displayName(l.issuedBy)}</span>
                  </div>
                </div>
                <div className="acts">
                  {l.returnedAt ? <Pill tone="ok">Vráceno</Pill> : <Pill tone="warn">Venku</Pill>}
                  <a href={`/keys/loans/${l.id}/pdf`} target="_blank" rel="noopener" className="btn sm">
                    PDF
                  </a>
                </div>
              </div>
            ))
          ) : (
            <div className="empty">Svazek zatím nikdo nepůjčil.</div>
          )}
        </div>
      </section>
    </>
  );
}
