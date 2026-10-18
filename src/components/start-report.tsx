import type { Building } from '@prisma/client';
import { TEMPLATES } from '@/lib/templates';
import { startReport } from '@/app/inspections/reports/actions';
import { Submit } from './forms';

/** Výběr objektu a šablony; po odeslání otevře nový protokol. */
export function StartReport({ buildings, buildingId }: { buildings: Pick<Building, 'id' | 'name'>[]; buildingId?: string }) {
  return (
    <form action={startReport} className="start-rep">
      {buildingId ? (
        <input type="hidden" name="buildingId" value={buildingId} />
      ) : (
        <select name="buildingId" required defaultValue="" aria-label="Objekt">
          <option value="" disabled>
            Vyberte objekt…
          </option>
          {buildings.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      )}
      <select name="template" defaultValue={TEMPLATES[0].key} aria-label="Druh protokolu">
        {TEMPLATES.map((t) => (
          <option key={t.key} value={t.key}>
            {t.label}
          </option>
        ))}
      </select>
      <Submit pending="Zakládám…">Začít kontrolu</Submit>
    </form>
  );
}
