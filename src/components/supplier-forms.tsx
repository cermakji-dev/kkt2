import { AddPanel } from './forms';
import { createContract, createSupplier } from '@/app/suppliers/actions';
import { SUPPLIER_CATEGORIES } from '@/lib/suppliers';

export function SupplierFields({ s }: { s?: { name: string; ico: string | null; category: string; contactName: string | null; phone: string | null; emergencyPhone: string | null; email: string | null; web: string | null; note: string | null } }) {
  return (
    <>
      <label>
        Název firmy *
        <input name="name" required maxLength={160} defaultValue={s?.name} />
      </label>
      <label>
        Obor
        <select name="category" defaultValue={s?.category ?? 'JINE'}>
          {Object.entries(SUPPLIER_CATEGORIES).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <label>
        IČO
        <input name="ico" maxLength={20} inputMode="numeric" defaultValue={s?.ico ?? ''} />
      </label>
      <label>
        Kontaktní osoba
        <input name="contactName" maxLength={120} defaultValue={s?.contactName ?? ''} />
      </label>
      <label>
        Telefon
        <input name="phone" type="tel" maxLength={40} defaultValue={s?.phone ?? ''} />
      </label>
      <label>
        Havarijní linka (24/7)
        <input name="emergencyPhone" type="tel" maxLength={40} defaultValue={s?.emergencyPhone ?? ''} />
      </label>
      <label>
        E-mail
        <input name="email" type="email" maxLength={120} defaultValue={s?.email ?? ''} />
      </label>
      <label>
        Web
        <input name="web" maxLength={200} defaultValue={s?.web ?? ''} placeholder="www…" />
      </label>
      <label className="wide">
        Poznámka
        <input name="note" maxLength={2000} defaultValue={s?.note ?? ''} placeholder="Ceník, zkušenosti, kdy volat…" />
      </label>
    </>
  );
}

export function AddSupplier() {
  return (
    <AddPanel label="Nová firma" submitLabel="Přidat firmu" action={createSupplier}>
      <SupplierFields />
    </AddPanel>
  );
}

export function AddContract({ suppliers, buildings, supplierId, buildingId }: { suppliers: { id: string; name: string }[]; buildings: { id: string; name: string }[]; supplierId?: string; buildingId?: string }) {
  return (
    <AddPanel label="Nová smlouva" submitLabel="Přidat smlouvu" action={createContract}>
      {supplierId ? (
        <input type="hidden" name="supplierId" value={supplierId} />
      ) : (
        <label>
          Firma *
          <select name="supplierId" required defaultValue="">
            <option value="" disabled>
              Vyberte…
            </option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {buildingId ? (
        <input type="hidden" name="buildingId" value={buildingId} />
      ) : (
        <label>
          Dům
          <select name="buildingId" defaultValue="">
            <option value="">Všechny / rámcová</option>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="wide">
        Předmět smlouvy *
        <input name="title" required maxLength={200} placeholder="Např. Servis výtahu, úklid společných prostor" />
      </label>
      <label>
        Platná od
        <input name="validFrom" type="date" />
      </label>
      <label>
        Platná do
        <input name="validTo" type="date" />
      </label>
      <label>
        Výpovědní lhůta (dní)
        <input name="noticeDays" type="number" min={0} max={730} placeholder="90" />
      </label>
      <label>
        Cena
        <input name="price" maxLength={120} placeholder="1 900 Kč / měsíc" />
      </label>
      <label className="check">
        <input type="checkbox" name="autoRenew" /> Automaticky se prodlužuje
      </label>
      <label className="wide">
        Poznámka
        <input name="note" maxLength={2000} />
      </label>
    </AddPanel>
  );
}
