import Link from 'next/link';
import type { InspectionReport } from '@prisma/client';
import { getTemplate, reportStats, type ItemsMap } from '@/lib/templates';
import { fmtDate } from '@/lib/format';
import { displayName } from '@/lib/auth';
import { Pill } from './ui';

type R = InspectionReport & {
  building?: { id: string; name: string };
  inspector: { name: string | null; email: string } | null;
  _count: { attachments: number };
};

export function ReportRow({ r, showBuilding = true }: { r: R; showBuilding?: boolean }) {
  const t = getTemplate(r.template);
  const st = t ? reportStats(t, (r.items ?? {}) as ItemsMap) : { filled: 0, total: 0, defects: 0 };
  return (
    <Link href={`/inspections/reports/${r.id}`} className="row click">
      <div className="main">
        <div className="t">
          {t?.label ?? r.template}
          {showBuilding && r.building && <span className="muted"> · {r.building.name}</span>}
        </div>
        <div className="s">
          <span>{fmtDate(r.date)}</span>
          <span>{displayName(r.inspector)}</span>
          {r._count.attachments > 0 && <span>📷 {r._count.attachments}</span>}
        </div>
      </div>
      <div className="acts">
        {r.status === 'DRAFT' ? (
          <>
            <span className="mono due">
              {st.filled}/{st.total}
            </span>
            <Pill tone="warn">Rozpracováno</Pill>
          </>
        ) : st.defects ? (
          <Pill tone="bad">{st.defects} závad</Pill>
        ) : (
          <Pill tone="ok">Bez závad</Pill>
        )}
        {r.status === 'FINAL' && <span className="btn sm">PDF</span>}
      </div>
    </Link>
  );
}

export const reportInclude = {
  inspector: { select: { name: true, email: true } },
  _count: { select: { attachments: { where: { kind: 'PHOTO' as const } } } },
} as const;
