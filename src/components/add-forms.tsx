import type { Building } from '@prisma/client';
import type { PersonOpt } from './ui';
import { displayName } from '@/lib/auth';
import { AddPanel } from './forms';
import { BuildingSelect } from './ui';
import { createBuilding, createInspection, createKey, createTask } from '@/app/actions';
import { INSPECTION_TYPES, startOfToday, toInputDate } from '@/lib/format';

type B = Pick<Building, 'id' | 'name'>[];

export function AddBuilding() {
  return (
    <AddPanel label="Nový objekt" submitLabel="Přidat objekt" action={createBuilding}>
      <label>
        Název objektu
        <input name="name" required maxLength={120} placeholder="např. BD Vinohradská 12" />
      </label>
      <label>
        Adresa
        <input name="address" required maxLength={250} placeholder="Ulice, číslo, PSČ, obec" />
      </label>
      <label>
        Počet bytů
        <input name="units" type="number" min={0} max={10000} inputMode="numeric" />
      </label>
      <label className="wide">
        Poznámka
        <textarea name="notes" maxLength={2000} placeholder="Vchody, předseda SVJ, specifika…" />
      </label>
    </AddPanel>
  );
}

export function AddTask({ buildings, buildingId, people }: { buildings: B; buildingId?: string; people?: PersonOpt[] }) {
  return (
    <AddPanel label="Nový úkol" submitLabel="Přidat úkol" action={createTask} keepOpen>
      <label className="wide">
        Úkol
        <input name="title" required maxLength={200} placeholder="Co je potřeba udělat" />
      </label>
      <BuildingSelect buildings={buildings} value={buildingId} />
      <label>
        Termín
        <input name="dueAt" type="date" />
      </label>
      {people && (
        <label>
          Řeší
          <select name="assigneeId" defaultValue="auto">
            <option value="auto">Technik objektu</option>
            <option value="">Nepřiřazeno</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {displayName(p)}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="wide">
        Poznámka
        <input name="notes" maxLength={1000} placeholder="Nepovinné" />
      </label>
    </AddPanel>
  );
}

export function AddKey({ buildings, buildingId }: { buildings: B; buildingId?: string }) {
  return (
    <AddPanel label="Nový svazek" submitLabel="Přidat svazek" action={createKey}>
      <label>
        Kód svazku
        <input name="code" required maxLength={40} placeholder="např. VIN12-A" />
      </label>
      <label>
        Popis
        <input name="description" maxLength={200} placeholder="Vchod, sklep, kotelna…" />
      </label>
      <label>
        Počet kusů
        <input name="count" type="number" min={1} max={99} defaultValue={1} inputMode="numeric" />
      </label>
      <BuildingSelect buildings={buildings} value={buildingId} />
    </AddPanel>
  );
}

export function AddInspection({ buildings, buildingId }: { buildings: B; buildingId?: string }) {
  return (
    <AddPanel label="Zapsat kontrolu" submitLabel="Zapsat kontrolu" action={createInspection}>
      <label>
        Druh kontroly
        <select name="type" defaultValue={INSPECTION_TYPES[0]}>
          {INSPECTION_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </label>
      <BuildingSelect buildings={buildings} value={buildingId} />
      <label>
        Provedeno
        <input name="inspectedAt" type="date" defaultValue={toInputDate(startOfToday())} required />
      </label>
      <label>
        Další termín
        <input name="nextDue" type="date" />
      </label>
      <label>
        Výsledek
        <select name="result" defaultValue="OK">
          <option value="OK">Bez závad</option>
          <option value="DEFECT">Zjištěna závada</option>
        </select>
      </label>
      <label className="wide">
        Poznámka
        <input name="notes" maxLength={500} placeholder="Zjištění, technik, číslo zprávy…" />
      </label>
    </AddPanel>
  );
}
