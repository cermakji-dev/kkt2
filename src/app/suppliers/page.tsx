import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { Empty, Panel } from '@/components/ui';
import { AddContract, AddSupplier } from '@/components/supplier-forms';
import { ContractRow } from '@/components/contract-row';
import { contractState, SUPPLIER_CATEGORIES } from '@/lib/suppliers';

export const dynamic = 'force-dynamic';

export default async function Suppliers({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string; c?: string }> }) {
  const sp = await searchParams;
  const tab = sp.tab === 'smlouvy' ? 'smlouvy' : 'firmy';
  const q = (sp.q ?? '').trim();
  const where: Prisma.SupplierWhereInput = {
    AND: [
      sp.c ? { category: sp.c } : {},
      q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { contactName: { contains: q, mode: 'insensitive' } }, { ico: { contains: q } }] } : {},
    ],
  };
  const [suppliers, contracts, buildings] = await Promise.all([
    prisma.supplier.findMany({
      where,
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
      include: { _count: { select: { contracts: true, tickets: { where: { status: { in: ['NOVE', 'PRIJATO', 'PREDANO', 'RESI_SE'] } } } } } },
    }),
    prisma.contract.findMany({
      include: { supplier: { select: { id: true, name: true } }, building: { select: { id: true, name: true } } },
      orderBy: { validTo: { sort: 'asc', nulls: 'last' } },
    }),
    prisma.building.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ]);
  const attention = contracts.filter((c) => ['warn', 'bad'].includes(contractState(c).tone));
  const byCat = new Map<string, typeof suppliers>();
  for (const s of suppliers) byCat.set(s.category, [...(byCat.get(s.category) ?? []), s]);

  return (
    <>
      <div className="head">
        <div>
          <h1>Dodavatelé</h1>
          <p className="muted">
            {suppliers.length} firem · {contracts.length} smluv{attention.length ? ` · ${attention.length} vyžaduje pozornost` : ''}
          </p>
        </div>
      </div>
      <nav className="tabs">
        <Link href="/suppliers" aria-current={tab === 'firmy' ? 'page' : undefined}>
          Adresář firem<span className="cnt">{suppliers.length}</span>
        </Link>
        <Link href="/suppliers?tab=smlouvy" aria-current={tab === 'smlouvy' ? 'page' : undefined}>
          Smlouvy{attention.length ? <span className="cnt warn">{attention.length}</span> : null}
        </Link>
      </nav>

      {tab === 'firmy' ? (
        <>
          <div className="tbar">
            <div className="filters scroll">
              <Link href="/suppliers" className="chip" aria-current={!sp.c ? 'true' : undefined}>
                Všechny obory
              </Link>
              {Object.entries(SUPPLIER_CATEGORIES)
                .filter(([k]) => suppliers.some((s) => s.category === k) || sp.c === k)
                .map(([k, v]) => (
                  <Link key={k} href={`/suppliers?c=${k}`} className="chip" aria-current={sp.c === k ? 'true' : undefined}>
                    {v}
                  </Link>
                ))}
            </div>
            <form className="tbar-b" action="/suppliers">
              {sp.c && <input type="hidden" name="c" value={sp.c} />}
              <input name="q" type="search" defaultValue={q} placeholder="Firma, kontakt, IČO…" aria-label="Hledat firmu" className="mini" />
              <button className="btn sm">Hledat</button>
            </form>
          </div>
          <section className="panel addbar">
            <header>
              <h2 className="muted">Nová firma do adresáře</h2>
              <AddSupplier />
            </header>
          </section>
          {suppliers.length === 0 && <div className="panel empty">Žádná firma.</div>}
          {[...byCat.entries()].map(([cat, list]) => (
            <section key={cat} className="supsec">
              <h3 className="supcat">{SUPPLIER_CATEGORIES[cat] ?? cat}</h3>
              <div className="supgrid">
                {list.map((s) => (
                  <article key={s.id} className={'supcard' + (s.active ? '' : ' inactive')}>
                    <Link href={`/suppliers/${s.id}`} className="sup-name">
                      {s.name}
                    </Link>
                    <span className="muted small">
                      {s.contactName ?? 'bez kontaktní osoby'}
                      {s.ico && ` · IČO ${s.ico}`}
                    </span>
                    <div className="sup-call">
                      {s.emergencyPhone && (
                        <a href={`tel:${s.emergencyPhone.replace(/\s/g, '')}`} className="callbtn bad">
                          Havárie {s.emergencyPhone}
                        </a>
                      )}
                      {s.phone && (
                        <a href={`tel:${s.phone.replace(/\s/g, '')}`} className="callbtn">
                          {s.phone}
                        </a>
                      )}
                    </div>
                    <div className="sup-f">
                      {s.email && <span className="muted small">{s.email}</span>}
                      <span className="sp" />
                      <span className="meta-s">{s._count.contracts} smluv</span>
                      {s._count.tickets > 0 && <span className="flag warn">{s._count.tickets} hlášení</span>}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </>
      ) : (
        <div className="stack">
          {attention.length > 0 && (
            <Panel title="Vyžaduje pozornost" count={attention.length}>
              {attention.map((c) => (
                <ContractRow key={c.id} c={c} />
              ))}
            </Panel>
          )}
          <Panel title="Všechny smlouvy" count={contracts.length} action={<AddContract suppliers={suppliers} buildings={buildings} />}>
            {contracts.length ? contracts.map((c) => <ContractRow key={c.id} c={c} />) : <Empty>Zatím žádné smlouvy.</Empty>}
          </Panel>
        </div>
      )}
    </>
  );
}
