import { prisma } from '@/lib/prisma';
import { Empty, KeyRow, Panel } from '@/components/ui';
import { AddKey } from '@/components/add-forms';

export const dynamic = 'force-dynamic';

export default async function Keys() {
  const [keys, buildings] = await Promise.all([
    prisma.keySet.findMany({
      include: { building: { select: { id: true, name: true } } },
      orderBy: { code: 'asc' },
    }),
    prisma.building.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ]);
  const lent = keys.filter((k) => k.holder);
  const home = keys.filter((k) => !k.holder);

  return (
    <>
      <div className="head">
        <div>
          <h1>Klíče</h1>
          <p className="muted">Evidence svazků a výpůjček.</p>
        </div>
      </div>
      <div className="stack">
        <Panel title="Zapůjčené" count={lent.length}>
          {lent.length ? lent.map((k) => <KeyRow key={k.id} k={k} />) : <Empty>Všechny klíče jsou v kanceláři.</Empty>}
        </Panel>
        <Panel title="V kanceláři" count={home.length} action={<AddKey buildings={buildings} />}>
          {home.length ? home.map((k) => <KeyRow key={k.id} k={k} />) : <Empty>Žádné svazky v kanceláři.</Empty>}
        </Panel>
      </div>
    </>
  );
}
