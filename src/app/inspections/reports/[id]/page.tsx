import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { displayName } from '@/lib/auth';
import { getTemplate, itemKey, reportStats, type ItemsMap } from '@/lib/templates';
import { fmtDate, toInputDate } from '@/lib/format';
import ReportEditor from '@/components/report-editor';
import { DeleteButton } from '@/components/forms';
import { Pill, TaskRow } from '@/components/ui';
import { deleteReport } from '../actions';

export const dynamic = 'force-dynamic';

const STATE_LABEL = { OK: 'V pořádku', DEFECT: 'Závada', NA: 'Nehodnoceno' } as const;
const STATE_TONE = { OK: 'ok', DEFECT: 'bad', NA: '' } as const;

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await prisma.inspectionReport.findUnique({
    where: { id },
    include: {
      building: { select: { id: true, name: true, address: true } },
      inspector: { select: { id: true, name: true, email: true } },
      attachments: { select: { id: true, kind: true, itemKey: true }, orderBy: { createdAt: 'asc' } },
      tasks: { include: { assignee: { select: { id: true, name: true, email: true } } } },
    },
  });
  if (!r) notFound();
  const t = getTemplate(r.template);
  if (!t) notFound();
  const items = (r.items ?? {}) as ItemsMap;
  const st = reportStats(t, items);

  return (
    <>
      <Link href={`/buildings/${r.building.id}`} className="back">
        ← {r.building.name}
      </Link>
      <div className="head">
        <div>
          <h1>{t.label}</h1>
          <div className="meta">
            <span>{r.building.address}</span>
            <span>Kontroluje {displayName(r.inspector)}</span>
          </div>
        </div>
        <div className="head-act">
          {r.status === 'DRAFT' ? <Pill tone="warn">Rozpracováno</Pill> : <Pill tone="ok">Dokončeno {fmtDate(r.finalizedAt)}</Pill>}
          <a href={`/inspections/reports/${r.id}/pdf`} className="btn sm" target="_blank" rel="noopener">
            {r.status === 'DRAFT' ? 'Náhled PDF' : 'Stáhnout PDF'}
          </a>
          {r.status === 'DRAFT' && <DeleteButton action={deleteReport} id={r.id} label="Zahodit" />}
        </div>
      </div>

      {r.status === 'DRAFT' ? (
        <ReportEditor
          reportId={r.id}
          template={t}
          initial={{
            items,
            summary: r.summary ?? '',
            svjName: r.svjName ?? '',
            date: toInputDate(r.date),
            nextDue: r.nextDue ? toInputDate(r.nextDue) : '',
          }}
          attachments={r.attachments.map((a) => ({ id: a.id, kind: a.kind, itemKey: a.itemKey }))}
        />
      ) : (
        <div className="stack">
          <div className="stats three">
            <div className="stat">
              <span>Datum</span>
              <b className="sm">{fmtDate(r.date)}</b>
              <em>další {fmtDate(r.nextDue) || '—'}</em>
            </div>
            <div className={'stat' + (st.defects ? ' hot' : '')}>
              <span>Závady</span>
              <b>{st.defects}</b>
              <em>z {st.total} položek</em>
            </div>
            <div className="stat">
              <span>Fotky</span>
              <b>{r.attachments.filter((a) => a.kind === 'PHOTO').length}</b>
              <em>{r.svjName ? `za SVJ: ${r.svjName}` : 'bez zástupce SVJ'}</em>
            </div>
          </div>
          {r.tasks.length > 0 && (
            <section className="panel">
              <header>
                <h2>
                  Úkoly ze závad<span className="count">{r.tasks.length}</span>
                </h2>
              </header>
              <div className="rows">
                {r.tasks.map((x) => (
                  <TaskRow key={x.id} t={x} showBuilding={false} />
                ))}
              </div>
            </section>
          )}
          {t.sections.map((sec, si) => (
            <section key={sec.key} className="panel">
              <header>
                <h2>
                  {si + 1}. {sec.label}
                </h2>
              </header>
              <div className="rows">
                {sec.items.map((it) => {
                  const k = itemKey(sec, it);
                  const v = items[k] ?? {};
                  const s = v.s ?? 'NA';
                  const photos = r.attachments.filter((a) => a.kind === 'PHOTO' && a.itemKey === k);
                  return (
                    <div key={k} className="row">
                      <div className="main">
                        <div className="t">{it.label}</div>
                        {v.n?.trim() && <div className="s">{v.n}</div>}
                        {photos.length > 0 && (
                          <div className="rep-photos ro">
                            {photos.map((p) => (
                              <a key={p.id} href={`/api/attachments/${p.id}`} target="_blank" rel="noopener" className="thumb">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={`/api/attachments/${p.id}`} alt="" loading="lazy" />
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="acts">
                        <Pill tone={STATE_TONE[s]}>{STATE_LABEL[s]}</Pill>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
          {r.summary && (
            <section className="panel">
              <header>
                <h2>Celkové zhodnocení</h2>
              </header>
              <p className="notes">{r.summary}</p>
            </section>
          )}
        </div>
      )}
    </>
  );
}
