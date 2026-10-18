import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getUser } from '@/lib/auth';
import { ActionForm } from '@/components/forms';
import { createTicket } from '../actions';
import { CATEGORIES, CHANNEL, URGENCY } from '@/lib/tickets';

export const dynamic = 'force-dynamic';

export default async function NewTicket({ searchParams }: { searchParams: Promise<{ b?: string }> }) {
  const me = (await getUser())!;
  const { b } = await searchParams;
  const buildings = await prisma.building.findMany({ select: { id: true, name: true, technicianId: true }, orderBy: { name: 'asc' } });
  const mine = buildings.filter((x) => x.technicianId === me.id);
  const sorted = [...mine, ...buildings.filter((x) => !mine.includes(x))];
  return (
    <>
      <Link href="/tickets" className="back">
        ← Hlášení závad
      </Link>
      <div className="head">
        <div>
          <h1>Nové hlášení</h1>
          <p className="muted">Zapište, co se děje. Hlášení se přidělí technikovi domu a začne běžet lhůta.</p>
        </div>
      </div>
      <section className="panel narrow">
        <ActionForm action={createTicket} submitLabel="Zapsat hlášení" className="add tform">
          <label className="wide">
            Co se stalo *
            <input name="title" required maxLength={200} placeholder="Např. Teče voda ze stropu ve 3. NP" autoFocus />
          </label>
          <label>
            Dům *
            <select name="buildingId" required defaultValue={b ?? ''}>
              <option value="" disabled>
                Vyberte dům…
              </option>
              {sorted.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Byt / místo
            <input name="unitLabel" maxLength={40} placeholder="Byt 12, sklep, vchod B…" />
          </label>
          <fieldset className="wide urg">
            <legend>Naléhavost</legend>
            {(Object.keys(URGENCY) as (keyof typeof URGENCY)[]).map((k) => (
              <label key={k} className={'urg-opt ' + URGENCY[k].tone}>
                <input type="radio" name="urgency" value={k} defaultChecked={k === 'BEZNA'} />
                <b>{URGENCY[k].label}</b>
                <small>{URGENCY[k].hint}</small>
              </label>
            ))}
          </fieldset>
          <label>
            Kategorie
            <select name="category" defaultValue="JINE">
              {Object.entries(CATEGORIES).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label>
            Jak přišlo
            <select name="channel" defaultValue="TELEFON">
              {Object.entries(CHANNEL).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="wide">
            Podrobnosti
            <textarea name="description" rows={3} maxLength={4000} placeholder="Kde přesně, od kdy, co už se zkoušelo…" />
          </label>
          <label>
            Kdo hlásí
            <input name="reporterName" maxLength={120} placeholder="Jméno" />
          </label>
          <label>
            Telefon
            <input name="reporterPhone" type="tel" maxLength={40} placeholder="+420 …" />
          </label>
          <label>
            E-mail
            <input name="reporterEmail" type="email" maxLength={120} />
          </label>
        </ActionForm>
      </section>
    </>
  );
}
