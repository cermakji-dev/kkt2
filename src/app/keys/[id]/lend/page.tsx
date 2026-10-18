import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { displayName, getUser } from '@/lib/auth';
import { ActionForm } from '@/components/forms';
import SignatureField from '@/components/signature-field';
import { createLoan } from '../../actions';
import { startOfToday, toInputDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function Lend({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [me, k] = await Promise.all([
    getUser(),
    prisma.keySet.findUnique({ where: { id }, include: { building: { select: { id: true, name: true, address: true } } } }),
  ]);
  if (!k) notFound();
  if (k.holder) redirect(`/keys/${k.id}`);
  // Opakovaní přebírající (firmy) pro rychlé doplnění.
  const recent = await prisma.keyLoan.findMany({
    distinct: ['holder'],
    orderBy: { borrowedAt: 'desc' },
    take: 30,
    select: { holder: true, holderCompany: true, holderPhone: true },
  });
  const week = toInputDate(new Date(startOfToday().getTime() + 7 * 86_400_000));

  return (
    <>
      <Link href={`/keys/${k.id}`} className="back">
        ← {k.code}
      </Link>
      <div className="head">
        <div>
          <p className="eyebrow muted">Předávací protokol</p>
          <h1>
            Zapůjčit <span className="code big">{k.code}</span>
          </h1>
          <p className="muted">
            {k.description} · {k.building.name}
            {k.count ? ` · ${k.count} ks` : ''}
          </p>
        </div>
      </div>
      <section className="panel">
        <ActionForm action={createLoan} submitLabel="Předat klíče" className="add lendform">
          <input type="hidden" name="keySetId" value={k.id} />
          <label>
            Jméno přebírajícího *
            <input name="holder" required maxLength={120} list="holders" autoComplete="off" placeholder="Jméno a příjmení" />
            <datalist id="holders">
              {recent.map((r) => (
                <option key={r.holder} value={r.holder} />
              ))}
            </datalist>
          </label>
          <label>
            Firma
            <input name="holderCompany" maxLength={120} list="companies" autoComplete="off" placeholder="Nepovinné" />
            <datalist id="companies">
              {[...new Set(recent.map((r) => r.holderCompany).filter(Boolean))].map((c) => (
                <option key={c!} value={c!} />
              ))}
            </datalist>
          </label>
          <label>
            Telefon
            <input name="holderPhone" type="tel" maxLength={40} placeholder="+420 …" />
          </label>
          <label>
            Vrátit do
            <input name="expectedReturn" type="date" defaultValue={week} />
          </label>
          <label className="wide">
            Účel
            <input name="purpose" maxLength={200} placeholder="Např. servis kotelny, odečty, malování" />
          </label>
          <label className="wide">
            Poznámka
            <input name="note" maxLength={1000} placeholder="Stav klíčů, počet kusů, kauce…" />
          </label>
          <div className="wide sigs">
            <SignatureField name="sigHolder" label="Podpis přebírajícího" required />
            <SignatureField name="sigIssuer" label={`Předává: ${displayName(me)}`} />
          </div>
        </ActionForm>
      </section>
    </>
  );
}
