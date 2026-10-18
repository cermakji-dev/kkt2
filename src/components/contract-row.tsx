import Link from 'next/link';
import type { Contract } from '@prisma/client';
import { contractState } from '@/lib/suppliers';
import { fmtDate } from '@/lib/format';
import { DeleteButton } from './forms';
import { deleteContract } from '@/app/suppliers/actions';

export function ContractRow({
  c,
  showSupplier = true,
  showBuilding = true,
}: {
  c: Contract & { supplier?: { id: string; name: string }; building?: { id: string; name: string } | null };
  showSupplier?: boolean;
  showBuilding?: boolean;
}) {
  const st = contractState(c);
  return (
    <div className="row">
      <div className="main">
        <div className="t">
          {c.title}
          {showSupplier && c.supplier && (
            <>
              {' · '}
              <Link href={`/suppliers/${c.supplier.id}`} className="blink">
                {c.supplier.name}
              </Link>
            </>
          )}
        </div>
        <div className="s">
          {showBuilding && <span>{c.building ? c.building.name : 'rámcová (všechny domy)'}</span>}
          <span>
            {c.validFrom ? fmtDate(c.validFrom) : '…'} – {c.validTo ? fmtDate(c.validTo) : 'neurčito'}
          </span>
          {c.noticeDays != null && <span>výpověď {c.noticeDays} d předem</span>}
          {st.noticeBy && c.validTo && <span>výpověď nejpozději {fmtDate(st.noticeBy)}</span>}
          {c.price && <span>{c.price}</span>}
          {c.autoRenew && <span>auto. prodloužení</span>}
        </div>
      </div>
      <div className="acts">
        <span className={'pill ' + st.tone}>{st.label}</span>
        <DeleteButton action={deleteContract} id={c.id} />
      </div>
    </div>
  );
}
