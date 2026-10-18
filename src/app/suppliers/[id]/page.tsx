import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { Empty, Panel } from '@/components/ui';
import { ActionForm } from '@/components/forms';
import { AddContract, SupplierFields } from '@/components/supplier-forms';
import { ContractRow } from '@/components/contract-row';
import { TicketHead, TicketRow, ticketInclude } from '@/components/ticket-row';
import { updateSupplier } from '../actions';
import { SUPPLIER_CATEGORIES } from '@/lib/suppliers';

export const dynamic = 'force-dynamic';

export default async function SupplierDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [s, buildings] = await Promise.all([
    prisma.supplier.findUnique({
      where: { id },
      include: {
        contracts: { include: { building: { select: { id: true, name: true } } }, orderBy: { validTo: 'asc' } },
        tickets: { include: ticketInclude, orderBy: { createdAt: 'desc' }, take: 30 },
      },
    }),
    prisma.building.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ]);
  if (!s) notFound();
  return (
    <>
      <Link href="/suppliers" className="back">
        ← Dodavatelé
      </Link>
      <div className="head">
        <div>
          <p className="eyebrow muted">{SUPPLIER_CATEGORIES[s.category] ?? s.category}</p>
          <h1>{s.name}</h1>
          <div className="meta">
            {s.contactName && <span>{s.contactName}</span>}
            {s.ico && <span>IČO {s.ico}</span>}
            {s.email && <span>{s.email}</span>}
            {s.web && <span>{s.web}</span>}
          </div>
        </div>
        <div className="head-act">
          {s.emergencyPhone && (
            <a href={`tel:${s.emergencyPhone.replace(/\s/g, '')}`} className="callbtn bad">
              Havárie {s.emergencyPhone}
            </a>
          )}
          {s.phone && (
            <a href={`tel:${s.phone.replace(/\s/g, '')}`} className="callbtn">
              Zavolat {s.phone}
            </a>
          )}
        </div>
      </div>
      <div className="detail2">
        <div className="stack">
          <Panel title="Smlouvy" count={s.contracts.length} action={<AddContract suppliers={[]} buildings={buildings} supplierId={s.id} />}>
            {s.contracts.length ? s.contracts.map((c) => <ContractRow key={c.id} c={c} showSupplier={false} />) : <Empty>Žádné smlouvy.</Empty>}
          </Panel>
          <section className="xlist">
            <h3 className="tgroup-h">
              Předaná hlášení<span className="count">{s.tickets.length}</span>
            </h3>
            {s.tickets.length > 0 && <TicketHead />}
            {s.tickets.map((t) => (
              <TicketRow key={t.id} t={t} />
            ))}
            {s.tickets.length === 0 && <div className="empty">Firmě zatím nebylo nic předáno.</div>}
          </section>
        </div>
        <aside className="stack">
          <details className="panel assign" open={false}>
            <summary>Upravit údaje firmy</summary>
            <ActionForm action={updateSupplier} submitLabel="Uložit">
              <input type="hidden" name="id" value={s.id} />
              <SupplierFields s={s} />
              <label className="check">
                <input type="checkbox" name="active" defaultChecked={s.active} /> Aktivní dodavatel
              </label>
            </ActionForm>
          </details>
          {s.note && (
            <section className="panel">
              <header>
                <h2>Poznámka</h2>
              </header>
              <p className="notes">{s.note}</p>
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
