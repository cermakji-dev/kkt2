import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { Empty, InspectionRow, KeyRow, Panel } from '@/components/ui';
import { AddInspection, AddKey } from '@/components/add-forms';
import { ActionForm, AddPanel, DeleteButton } from '@/components/forms';
import { assignBuilding, deleteBuilding } from '@/app/actions';
import { quickAdd } from '@/app/tasks/actions';
import { addContact, addMeter, addReading, addUnit, deleteContact, deleteDocument, deleteMeter, deleteUnit, updateBuildingInfo, uploadDocument } from '../actions';
import { daysUntil, fmtDate } from '@/lib/format';
import { displayName, getUser, initials } from '@/lib/auth';
import { activePeople } from '@/lib/people';
import { StartReport } from '@/components/start-report';
import { ReportRow, reportInclude } from '@/components/report-list';
import { TaskHead, TaskItem, taskItemInclude } from '@/components/task-item';
import { QuickAdd } from '@/components/task-client';
import { TicketHead, TicketRow, ticketInclude } from '@/components/ticket-row';
import { ContractRow } from '@/components/contract-row';
import { AddContract } from '@/components/supplier-forms';
import { buildingHealth } from '@/lib/health';
import { sortTasks } from '@/lib/tasks';
import { OPEN_STATUSES } from '@/lib/tickets';
import { revisionMatrix, STATE_META } from '@/lib/revisions';
import { CONTACT_ROLE, DOC_CATEGORY, fmtSize, METER_KIND, UNIT_TYPE } from '@/lib/building-meta';

export const dynamic = 'force-dynamic';

const TABS = [
  { key: 'prehled', label: 'Přehled' },
  { key: 'dum', label: 'Dům' },
  { key: 'jednotky', label: 'Jednotky' },
  { key: 'meridla', label: 'Měřidla' },
  { key: 'ukoly', label: 'Úkoly' },
  { key: 'zavady', label: 'Závady' },
  { key: 'kontroly', label: 'Revize' },
  { key: 'klice', label: 'Klíče' },
  { key: 'dokumenty', label: 'Dokumenty' },
  { key: 'dodavatele', label: 'Dodavatelé' },
] as const;
type Tab = (typeof TABS)[number]['key'];

const tel = (p: string) => `tel:${p.replace(/\s/g, '')}`;
const years = (m: number) => (m >= 12 ? `${m / 12} ${m / 12 === 1 ? 'rok' : m / 12 < 5 ? 'roky' : 'let'}` : `${m} měs.`);

export default async function BuildingDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params;
  const { tab: rawTab } = await searchParams;
  const tab: Tab = TABS.some((t) => t.key === rawTab) ? (rawTab as Tab) : 'prehled';
  const person = { select: { id: true, name: true, email: true, phone: true } } as const;
  const [me, people, b, suppliers] = await Promise.all([
    getUser(),
    activePeople(),
    prisma.building.findUnique({
      where: { id },
      include: {
        technician: person,
        referent: person,
        tasks: { where: { parentId: null }, include: taskItemInclude },
        keys: { orderBy: { code: 'asc' }, include: { loans: { where: { returnedAt: null }, select: { expectedReturn: true, purpose: true }, take: 1 } } },
        inspections: { orderBy: { inspectedAt: 'desc' } },
        reports: { include: reportInclude, orderBy: { date: 'desc' }, take: 20 },
        contacts: { orderBy: [{ role: 'asc' }, { name: 'asc' }] },
        unitList: { orderBy: [{ entrance: 'asc' }, { label: 'asc' }] },
        meters: { orderBy: [{ kind: 'asc' }, { serial: 'asc' }], include: { unit: { select: { label: true } }, readings: { orderBy: { date: 'desc' }, take: 2 } } },
        documents: { orderBy: { createdAt: 'desc' }, select: { id: true, title: true, category: true, fileName: true, size: true, mime: true, createdAt: true, uploadedBy: { select: { name: true, email: true } } } },
        contracts: { include: { supplier: { select: { id: true, name: true } } }, orderBy: { validTo: 'asc' } },
        tickets: { include: ticketInclude, orderBy: { createdAt: 'desc' }, take: 50 },
      },
    }),
    prisma.supplier.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ]);
  if (!b) notFound();
  const isAdmin = me?.role === 'ADMIN';
  const canEdit = isAdmin || me?.id === b.technicianId || me?.id === b.referentId;
  const open = b.tasks.filter((t) => t.status !== 'DONE').sort(sortTasks);
  const done = b.tasks.filter((t) => t.status === 'DONE').sort((x, y) => (y.completedAt?.getTime() ?? 0) - (x.completedAt?.getTime() ?? 0));
  const matrix = revisionMatrix(b, b.inspections);
  const applicable = matrix.filter((c) => c.state !== 'na');
  const revMissing = matrix.filter((c) => c.state === 'missing').length;
  const health = buildingHealth({ tasks: b.tasks, inspections: b.inspections });
  const keysOut = b.keys.filter((k) => k.holder);
  const drafts = b.reports.filter((r) => r.status === 'DRAFT');
  const finals = b.reports.filter((r) => r.status === 'FINAL');
  const openTickets = b.tickets.filter((t) => OPEN_STATUSES.includes(t.status));
  const linked = b.tasks.length + b.keys.length + b.inspections.length + b.reports.length + b.tickets.length;
  const meterLate = b.meters.filter((m) => m.verifiedUntil && daysUntil(m.verifiedUntil) < 0).length;
  const tabCount: Partial<Record<Tab, number>> = {
    ukoly: open.length,
    zavady: openTickets.length,
    kontroly: matrix.filter((c) => c.state === 'late' || c.state === 'missing').length,
    klice: b.keys.length,
    jednotky: b.unitList.length,
    meridla: b.meters.length,
    dokumenty: b.documents.length,
    dodavatele: b.contracts.length,
  };
  const tabWarn: Partial<Record<Tab, boolean>> = {
    zavady: openTickets.some((x) => x.urgency === 'HAVARIE'),
    kontroly: matrix.some((c) => c.state === 'late' || c.state === 'missing'),
    meridla: meterLate > 0,
  };
  const chair = b.contacts.find((c) => c.role === 'PREDSEDA');
  const order = ['late', 'missing', 'soon', 'ok'];

  return (
    <>
      <Link href="/buildings" className="back">
        ← Objekty
      </Link>
      <div className="bhead">
        <div className="bhead-main">
          <div className="bc-top">
            <span className={'hdot ' + health.tone} aria-hidden="true" />
            <span className={'bc-status ' + health.tone}>{health.label}</span>
            {b.code && <span className="code">stř. {b.code}</span>}
          </div>
          <h1>{b.name}</h1>
          <div className="meta">
            <span>{b.address}</span>
            {b.svjName && <span>{b.svjName}</span>}
            {b.ico && <span className="mono">IČO {b.ico}</span>}
          </div>
        </div>
        <div className="bhead-people">
          {[
            { role: 'Technik', name: b.technician ? displayName(b.technician) : null, ini: b.technician ? initials(b.technician) : '?', phone: b.technician?.phone },
            { role: 'Referent', name: b.referent ? displayName(b.referent) : null, ini: b.referent ? initials(b.referent) : '?', phone: b.referent?.phone },
            ...(chair ? [{ role: 'Předseda výboru', name: chair.name, ini: initials({ name: chair.name, email: chair.name }), phone: chair.phone }] : []),
          ].map((p) => (
            <div key={p.role} className="bperson">
              <span className={'avatar sm' + (p.name ? '' : ' empty')}>{p.ini}</span>
              <div>
                <span className="lbl">{p.role}</span>
                <b>{p.name ?? 'Nepřiřazeno'}</b>
                {p.phone && (
                  <a href={tel(p.phone)} className="mono small">
                    {p.phone}
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <nav className="tabs" aria-label="Části karty objektu">
        {TABS.map((t) => (
          <Link key={t.key} href={t.key === 'prehled' ? `/buildings/${b.id}` : `/buildings/${b.id}?tab=${t.key}`} aria-current={tab === t.key ? 'page' : undefined} scroll={false}>
            {t.label}
            {tabCount[t.key] ? <span className={'cnt' + (tabWarn[t.key] ? ' warn' : '')}>{tabCount[t.key]}</span> : null}
          </Link>
        ))}
      </nav>

      {tab === 'prehled' && (
        <div className="grid2 wide3">
          <div className="stack">
            <section className={'panel healthcard ' + health.tone}>
              <header>
                <h2>Co je potřeba</h2>
              </header>
              <ul className="whylist">
                {health.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
                {revMissing > 0 && <li>{revMissing} revizí bez záznamu v evidenci</li>}
                {meterLate > 0 && <li>{meterLate} měřidel s prošlým ověřením</li>}
              </ul>
              <div className="quickacts">
                <StartReport buildings={[]} buildingId={b.id} />
                <div className="qa-row">
                  <Link href={`/tickets/new?b=${b.id}`} className="btn sm">
                    + Nahlásit závadu
                  </Link>
                  <Link href={`?tab=meridla`} className="btn sm">
                    Zapsat odečet
                  </Link>
                </div>
              </div>
            </section>
            <Panel title="Otevřené závady" count={openTickets.length} action={<Link href={`?tab=zavady`} className="more">Vše →</Link>}>
              {openTickets.length ? openTickets.slice(0, 5).map((t) => <TicketRow key={t.id} t={t} showBuilding={false} />) : <Empty>Žádné otevřené hlášení.</Empty>}
            </Panel>
            <Panel title="Nejbližší úkoly" count={open.length} action={<Link href={`?tab=ukoly`} className="more">Všechny →</Link>}>
              {open.length ? open.slice(0, 6).map((t) => <TaskItem key={t.id} t={t} href={`/tasks?b=${b.id}&s=team&t=${t.id}`} showBuilding={false} />) : <Empty>Žádné otevřené úkoly.</Empty>}
            </Panel>
          </div>
          <div className="stack">
            <Panel title="Revize a termíny" action={<Link href={`?tab=kontroly`} className="more">Všechny →</Link>}>
              <div className="revmini">
                {[...applicable]
                  .sort((x, y) => order.indexOf(x.state) - order.indexOf(y.state))
                  .slice(0, 8)
                  .map((c) => (
                    <div key={c.rev.key} className="revmini-r">
                      <span className={'hdot ' + STATE_META[c.state].tone} />
                      <span className="t">{c.rev.label}</span>
                      <span className={'due ' + STATE_META[c.state].tone}>{c.nextDue ? fmtDate(c.nextDue) : STATE_META[c.state].label}</span>
                    </div>
                  ))}
              </div>
            </Panel>
            <Panel title="Klíče venku" count={keysOut.length}>
              {keysOut.length ? keysOut.map((k) => <KeyRow key={k.id} k={k} loan={k.loans[0]} showBuilding={false} />) : <Empty>Všechny klíče jsou v kanceláři.</Empty>}
            </Panel>
          </div>
          <div className="stack">
            <section className="panel">
              <header>
                <h2>Dům v kostce</h2>
                <Link href={`?tab=dum`} className="more">
                  Údaje →
                </Link>
              </header>
              <dl className="facts">
                <div><dt>Bytů</dt><dd>{b.units ?? '—'}</dd></div>
                <div><dt>Nebytů</dt><dd>{b.nonResidential ?? '—'}</dd></div>
                <div><dt>Garáží</dt><dd>{b.garages ?? '—'}</dd></div>
                <div><dt>Vchodů</dt><dd>{b.entrances ?? '—'}</dd></div>
                <div><dt>Podlaží</dt><dd>{b.floors ?? '—'}</dd></div>
                <div><dt>Postaveno</dt><dd>{b.yearBuilt ?? '—'}</dd></div>
              </dl>
              <div className="equip">
                {(
                  [
                    ['Výtah', b.hasElevator],
                    ['Plyn', b.hasGas],
                    ['Kotelna', b.hasBoiler],
                    ['Komín', b.hasChimney],
                    ['Hydranty', b.hasHydrants],
                  ] as const
                ).map(([l, v]) => (
                  <span key={l} className={'eq' + (v ? ' on' : '')}>
                    {v ? '✓' : '–'} {l}
                  </span>
                ))}
              </div>
              {b.heating && <p className="notes small">Vytápění: {b.heating}</p>}
            </section>
            {b.contacts.length > 0 && (
              <Panel title="Výbor a kontakty" count={b.contacts.length}>
                {b.contacts.slice(0, 5).map((c) => (
                  <div key={c.id} className="row">
                    <div className="main">
                      <div className="t">{c.name}</div>
                      <div className="s">
                        <span>{CONTACT_ROLE[c.role]}</span>
                        {c.unitLabel && <span>{c.unitLabel}</span>}
                      </div>
                    </div>
                    <div className="acts">
                      {c.phone && (
                        <a href={tel(c.phone)} className="btn sm">
                          {c.phone}
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </Panel>
            )}
            {b.notes && (
              <section className="panel">
                <header>
                  <h2>Poznámky</h2>
                </header>
                <p className="notes">{b.notes}</p>
              </section>
            )}
          </div>
        </div>
      )}

      {tab === 'dum' && (
        <div className="detail2">
          <section className="panel">
            <header>
              <h2>Údaje o domě</h2>
            </header>
            {canEdit ? (
              <ActionForm action={updateBuildingInfo} submitLabel="Uložit údaje" className="add infoform">
                <input type="hidden" name="id" value={b.id} />
                <label className="w2">
                  Název *
                  <input name="name" required maxLength={120} defaultValue={b.name} />
                </label>
                <label>
                  Číslo střediska
                  <input name="code" maxLength={20} defaultValue={b.code ?? ''} placeholder="např. 213" />
                </label>
                <label className="wide">
                  Adresa *
                  <input name="address" required maxLength={250} defaultValue={b.address} />
                </label>
                <label className="w2">
                  Společenství / družstvo
                  <input name="svjName" maxLength={200} defaultValue={b.svjName ?? ''} placeholder="Společenství vlastníků …" />
                </label>
                <label>
                  IČO
                  <input name="ico" maxLength={20} inputMode="numeric" defaultValue={b.ico ?? ''} />
                </label>
                <label className="w2">
                  Katastrální území
                  <input name="cadastralArea" maxLength={120} defaultValue={b.cadastralArea ?? ''} />
                </label>
                <label>
                  Rok výstavby
                  <input name="yearBuilt" type="number" min={1500} max={2100} defaultValue={b.yearBuilt ?? ''} />
                </label>
                <label>
                  Bytů
                  <input name="units" type="number" min={0} defaultValue={b.units ?? ''} />
                </label>
                <label>
                  Nebytových prostor
                  <input name="nonResidential" type="number" min={0} defaultValue={b.nonResidential ?? ''} />
                </label>
                <label>
                  Garáží / stání
                  <input name="garages" type="number" min={0} defaultValue={b.garages ?? ''} />
                </label>
                <label>
                  Vchodů
                  <input name="entrances" type="number" min={0} defaultValue={b.entrances ?? ''} />
                </label>
                <label>
                  Podlaží
                  <input name="floors" type="number" min={0} defaultValue={b.floors ?? ''} />
                </label>
                <label>
                  Vytápění
                  <input name="heating" maxLength={120} defaultValue={b.heating ?? ''} placeholder="CZT, domovní kotelna…" />
                </label>
                <fieldset className="wide equipset">
                  <legend>Vybavení – podle něj se hlídají revize</legend>
                  <label className="check"><input type="checkbox" name="hasElevator" defaultChecked={b.hasElevator} /> Výtah</label>
                  <label className="check"><input type="checkbox" name="hasGas" defaultChecked={b.hasGas} /> Plynové rozvody</label>
                  <label className="check"><input type="checkbox" name="hasBoiler" defaultChecked={b.hasBoiler} /> Domovní kotelna</label>
                  <label className="check"><input type="checkbox" name="hasChimney" defaultChecked={b.hasChimney} /> Komíny</label>
                  <label className="check"><input type="checkbox" name="hasHydrants" defaultChecked={b.hasHydrants} /> Požární hydranty</label>
                </fieldset>
                <label className="wide">
                  Poznámky
                  <textarea name="notes" rows={3} maxLength={4000} defaultValue={b.notes ?? ''} />
                </label>
              </ActionForm>
            ) : (
              <p className="notes muted">Údaje upravuje technik, referent domu nebo administrátor.</p>
            )}
          </section>
          <div className="stack">
            <Panel
              title="Výbor a kontakty"
              count={b.contacts.length}
              action={
                canEdit ? (
                  <AddPanel label="Přidat" submitLabel="Přidat kontakt" action={addContact}>
                    <input type="hidden" name="buildingId" value={b.id} />
                    <label>
                      Role
                      <select name="role" defaultValue="CLEN_VYBORU">
                        {Object.entries(CONTACT_ROLE).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Jméno *
                      <input name="name" required maxLength={120} />
                    </label>
                    <label>
                      Telefon
                      <input name="phone" type="tel" maxLength={40} />
                    </label>
                    <label>
                      E-mail
                      <input name="email" type="email" maxLength={120} />
                    </label>
                    <label>
                      Jednotka
                      <input name="unitLabel" maxLength={40} placeholder="byt 12" />
                    </label>
                  </AddPanel>
                ) : undefined
              }
            >
              {b.contacts.length ? (
                b.contacts.map((c) => (
                  <div key={c.id} className="row">
                    <div className="main">
                      <div className="t">{c.name}</div>
                      <div className="s">
                        <span>{CONTACT_ROLE[c.role]}</span>
                        {c.unitLabel && <span>{c.unitLabel}</span>}
                        {c.email && <span>{c.email}</span>}
                      </div>
                    </div>
                    <div className="acts">
                      {c.phone && (
                        <a href={tel(c.phone)} className="btn sm">
                          {c.phone}
                        </a>
                      )}
                      {canEdit && <DeleteButton action={deleteContact} id={c.id} label="Odebrat" />}
                    </div>
                  </div>
                ))
              ) : (
                <Empty>Zatím žádné kontakty. Přidejte předsedu výboru.</Empty>
              )}
            </Panel>
            {isAdmin && (
              <details className="panel assign">
                <summary>Přiřazení technika a referenta, smazání domu</summary>
                <ActionForm action={assignBuilding} submitLabel="Uložit přiřazení">
                  <input type="hidden" name="id" value={b.id} />
                  <label>
                    Technik
                    <select name="technicianId" defaultValue={b.technicianId ?? ''}>
                      <option value="">Nepřiřazeno</option>
                      {people.filter((p) => p.role !== 'REFERENT').map((p) => (
                        <option key={p.id} value={p.id}>
                          {displayName(p)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Referent
                    <select name="referentId" defaultValue={b.referentId ?? ''}>
                      <option value="">Nepřiřazeno</option>
                      {people.filter((p) => p.role !== 'TECHNIK').map((p) => (
                        <option key={p.id} value={p.id}>
                          {displayName(p)}
                        </option>
                      ))}
                    </select>
                  </label>
                </ActionForm>
                <div className="danger-zone">
                  {linked ? <span className="muted small">Dům má navázané záznamy ({linked}), nelze ho smazat.</span> : <DeleteButton action={deleteBuilding} id={b.id} label="Smazat dům" />}
                </div>
              </details>
            )}
          </div>
        </div>
      )}

      {tab === 'jednotky' && (
        <section className="panel">
          <header>
            <h2>
              Jednotky<span className="count">{b.unitList.length}</span>
            </h2>
            {canEdit && (
              <AddPanel label="Přidat jednotku" submitLabel="Přidat" action={addUnit} keepOpen>
                <input type="hidden" name="buildingId" value={b.id} />
                <label>
                  Číslo *
                  <input name="label" required maxLength={40} placeholder="2/14" />
                </label>
                <label>
                  Druh
                  <select name="type" defaultValue="BYT">
                    {Object.entries(UNIT_TYPE).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Vchod
                  <input name="entrance" maxLength={20} />
                </label>
                <label>
                  Podlaží
                  <input name="floor" type="number" />
                </label>
                <label>
                  Plocha m²
                  <input name="area" inputMode="decimal" />
                </label>
                <label>
                  Vlastník / nájemce
                  <input name="ownerName" maxLength={160} />
                </label>
                <label>
                  Telefon
                  <input name="ownerPhone" type="tel" maxLength={40} />
                </label>
                <label>
                  E-mail
                  <input name="ownerEmail" type="email" maxLength={120} />
                </label>
              </AddPanel>
            )}
          </header>
          <div className="tscroll">
            <table className="dtable">
              <thead>
                <tr>
                  <th>Č. jednotky</th>
                  <th>Druh</th>
                  <th>Vchod</th>
                  <th className="num">Podlaží</th>
                  <th className="num">m²</th>
                  <th>Vlastník / nájemce</th>
                  <th>Kontakt</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {b.unitList.map((u) => (
                  <tr key={u.id}>
                    <td className="mono">{u.label}</td>
                    <td>{UNIT_TYPE[u.type]}</td>
                    <td>{u.entrance ?? ''}</td>
                    <td className="num">{u.floor ?? ''}</td>
                    <td className="num">{u.area?.toLocaleString('cs-CZ') ?? ''}</td>
                    <td>{u.ownerName ?? <span className="muted">—</span>}</td>
                    <td>
                      {u.ownerPhone && (
                        <a href={tel(u.ownerPhone)} className="blink">
                          {u.ownerPhone}
                        </a>
                      )}
                      {u.ownerEmail && <span className="muted small"> {u.ownerEmail}</span>}
                    </td>
                    <td className="num">{canEdit && <DeleteButton action={deleteUnit} id={u.id} label="×" />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {b.unitList.length === 0 && <div className="empty">Jednotky zatím nejsou zapsané.</div>}
          </div>
        </section>
      )}

      {tab === 'meridla' && (
        <section className="panel">
          <header>
            <h2>
              Měřidla<span className="count">{b.meters.length}</span>
            </h2>
            {canEdit && (
              <AddPanel label="Přidat měřidlo" submitLabel="Přidat" action={addMeter} keepOpen>
                <input type="hidden" name="buildingId" value={b.id} />
                <label>
                  Druh
                  <select name="kind" defaultValue="SV">
                    {Object.entries(METER_KIND).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Výrobní číslo *
                  <input name="serial" required maxLength={60} />
                </label>
                <label>
                  Jednotka
                  <select name="unitId" defaultValue="">
                    <option value="">Společné / patní</option>
                    {b.unitList.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Umístění
                  <input name="location" maxLength={120} placeholder="koupelna, sklep…" />
                </label>
                <label>
                  Ověřeno do
                  <input name="verifiedUntil" type="date" />
                </label>
                <label>
                  nebo datum montáže
                  <input name="installedAt" type="date" title="Ověření se dopočítá: SV 6 let, TUV a teplo 5 let" />
                </label>
              </AddPanel>
            )}
          </header>
          <div className="tscroll">
            <table className="dtable">
              <thead>
                <tr>
                  <th>Druh</th>
                  <th>Výr. číslo</th>
                  <th>Jednotka / místo</th>
                  <th>Ověřeno do</th>
                  <th className="num">Poslední stav</th>
                  <th className="num">Spotřeba</th>
                  <th>Nový odečet</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {b.meters.map((m) => {
                  const k = METER_KIND[m.kind];
                  const [last, prev] = m.readings;
                  const exp = m.verifiedUntil ? daysUntil(m.verifiedUntil) : null;
                  return (
                    <tr key={m.id}>
                      <td>{k.label}</td>
                      <td className="mono">{m.serial}</td>
                      <td>
                        {m.unit?.label ?? 'společné'}
                        {m.location && <span className="muted small"> · {m.location}</span>}
                      </td>
                      <td className={exp != null && exp < 0 ? 'bad-t' : exp != null && exp < 180 ? 'warn-t' : ''}>{m.verifiedUntil ? fmtDate(m.verifiedUntil) : '—'}</td>
                      <td className="num mono">
                        {last ? (
                          <>
                            {last.value.toLocaleString('cs-CZ')} {k.unit}
                            <span className="muted small"> {fmtDate(last.date)}</span>
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="num mono">{last && prev ? `${(last.value - prev.value).toLocaleString('cs-CZ', { maximumFractionDigits: 3 })} ${k.unit}` : ''}</td>
                      <td>
                        <ActionForm action={addReading} submitLabel="Zapsat" className="readform" successText="">
                          <input type="hidden" name="meterId" value={m.id} />
                          <input name="value" inputMode="decimal" placeholder="stav" aria-label={`Nový stav ${m.serial}`} required />
                        </ActionForm>
                      </td>
                      <td className="num">{canEdit && <DeleteButton action={deleteMeter} id={m.id} label="×" />}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {b.meters.length === 0 && <div className="empty">Žádná měřidla v evidenci.</div>}
          </div>
        </section>
      )}

      {tab === 'ukoly' && (
        <>
          <QuickAdd action={quickAdd} placeholder={`Nový úkol pro ${b.name}… (Enter)`} hidden={{ buildingId: b.id, ...(b.technicianId ? { assigneeId: b.technicianId } : {}) }} />
          <section className="tlist no-bld">
            <TaskHead showBuilding={false} />
            {open.length ? open.map((t) => <TaskItem key={t.id} t={t} href={`/tasks?b=${b.id}&s=team&t=${t.id}`} showBuilding={false} />) : <div className="empty">Žádné otevřené úkoly.</div>}
          </section>
          {done.length > 0 && (
            <section className="tlist no-bld">
              <h3 className="tgroup-h">
                Dokončené<span className="count">{done.length}</span>
              </h3>
              {done.slice(0, 15).map((t) => (
                <TaskItem key={t.id} t={t} href={`/tasks?b=${b.id}&s=done&t=${t.id}`} showBuilding={false} />
              ))}
            </section>
          )}
        </>
      )}

      {tab === 'zavady' && (
        <>
          <div className="head-act" style={{ marginBottom: 12 }}>
            <Link href={`/tickets/new?b=${b.id}`} className="btn pri">
              + Nahlásit závadu
            </Link>
          </div>
          <section className="xlist">
            <TicketHead showBuilding={false} />
            {b.tickets.map((t) => (
              <TicketRow key={t.id} t={t} showBuilding={false} />
            ))}
            {b.tickets.length === 0 && <div className="empty">Žádná hlášení.</div>}
          </section>
        </>
      )}

      {tab === 'kontroly' && (
        <div className="stack">
          <section className="panel">
            <header>
              <h2>Zákonné revize a kontroly</h2>
              <span className="muted small">Podle vybavení domu (záložka Dům)</span>
            </header>
            <div className="tscroll">
              <table className="dtable">
                <thead>
                  <tr>
                    <th>Revize</th>
                    <th>Interval</th>
                    <th>Předpis</th>
                    <th>Naposledy</th>
                    <th>Další termín</th>
                    <th>Stav</th>
                  </tr>
                </thead>
                <tbody>
                  {applicable.map((c) => (
                    <tr key={c.rev.key}>
                      <td className="fw5">{c.rev.label}</td>
                      <td>{years(c.rev.months)}</td>
                      <td className="muted small">{c.rev.law}</td>
                      <td>
                        {c.last ? fmtDate(c.last.inspectedAt) : '—'}
                        {c.last?.result === 'DEFECT' && <span className="flag bad"> závada</span>}
                      </td>
                      <td>{c.nextDue ? fmtDate(c.nextDue) : '—'}</td>
                      <td>
                        <span className={'pill ' + STATE_META[c.state].tone}>{STATE_META[c.state].label}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <div className="grid2">
            <section className="panel start-panel">
              <header>
                <h2>Nová kontrola v terénu</h2>
              </header>
              <StartReport buildings={[]} buildingId={b.id} />
            </section>
            <Panel title="Zapsat revizní zprávu" action={<AddInspection buildings={[]} buildingId={b.id} />}>
              <p className="notes muted small">Další termín se doplní podle zákonného intervalu. Samotnou revizní zprávu (PDF) nahrajte do Dokumentů.</p>
            </Panel>
          </div>
          {drafts.length > 0 && (
            <Panel title="Rozpracované protokoly" count={drafts.length}>
              {drafts.map((r) => (
                <ReportRow key={r.id} r={r} showBuilding={false} />
              ))}
            </Panel>
          )}
          <Panel title="Protokoly" count={finals.length}>
            {finals.length ? finals.map((r) => <ReportRow key={r.id} r={r} showBuilding={false} />) : <Empty>Zatím žádný dokončený protokol.</Empty>}
          </Panel>
          <details className="panel history">
            <summary>
              <h2>
                Všechny záznamy<span className="count">{b.inspections.length}</span>
              </h2>
            </summary>
            <div className="rows">
              {b.inspections.map((x) => (
                <InspectionRow key={x.id} x={x} showBuilding={false} canDelete={isAdmin} />
              ))}
            </div>
          </details>
        </div>
      )}

      {tab === 'klice' && (
        <Panel title="Svazky klíčů" count={b.keys.length} action={<AddKey buildings={[]} buildingId={b.id} />}>
          {b.keys.length ? b.keys.map((k) => <KeyRow key={k.id} k={k} loan={k.loans[0]} showBuilding={false} />) : <Empty>Žádné svazky klíčů.</Empty>}
        </Panel>
      )}

      {tab === 'dokumenty' && (
        <section className="panel">
          <header>
            <h2>
              Dokumenty<span className="count">{b.documents.length}</span>
            </h2>
            {canEdit && (
              <AddPanel label="Nahrát dokument" submitLabel="Nahrát" action={uploadDocument}>
                <input type="hidden" name="buildingId" value={b.id} />
                <label>
                  Druh
                  <select name="category" defaultValue="REVIZNI_ZPRAVA">
                    {Object.entries(DOC_CATEGORY).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Název
                  <input name="title" maxLength={200} placeholder="Nevyplněno = název souboru" />
                </label>
                <label className="wide">
                  Soubor (PDF, obrázek, Word, Excel; max 3,8 MB)
                  <input name="file" type="file" required accept=".pdf,image/*,.doc,.docx,.xls,.xlsx,.txt" />
                </label>
              </AddPanel>
            )}
          </header>
          <div className="rows">
            {b.documents.map((d) => (
              <div key={d.id} className="row">
                <a href={`/api/documents/${d.id}`} target="_blank" rel="noopener" className="main rowlink">
                  <div className="t">
                    <span className="doc-ic">{d.mime === 'application/pdf' ? 'PDF' : d.mime.startsWith('image/') ? 'IMG' : 'DOC'}</span>
                    {d.title}
                  </div>
                  <div className="s">
                    <span>{DOC_CATEGORY[d.category]}</span>
                    <span>{fmtSize(d.size)}</span>
                    <span>
                      {fmtDate(d.createdAt)} · {displayName(d.uploadedBy)}
                    </span>
                  </div>
                </a>
                <div className="acts">{canEdit && <DeleteButton action={deleteDocument} id={d.id} />}</div>
              </div>
            ))}
            {b.documents.length === 0 && <Empty>Zatím žádné dokumenty. Nahrajte revizní zprávy, smlouvy nebo zápisy ze schůzí.</Empty>}
          </div>
        </section>
      )}

      {tab === 'dodavatele' && (
        <Panel title="Smlouvy domu" count={b.contracts.length} action={<AddContract suppliers={suppliers} buildings={[]} buildingId={b.id} />}>
          {b.contracts.length ? b.contracts.map((c) => <ContractRow key={c.id} c={c} showBuilding={false} />) : <Empty>Žádné smlouvy pro tento dům.</Empty>}
        </Panel>
      )}
    </>
  );
}
