import { prisma } from '@/lib/prisma';
import NewBuilding from './new-building';
export const dynamic = 'force-dynamic';
export default async function Buildings() {
 const buildings = await prisma.building.findMany({orderBy:{createdAt:'desc'}});
 return <><h1>Evidence objektů</h1><p className="muted">Seznam spravovaných domů a základní údaje.</p><div className="cards" style={{gridTemplateColumns:'minmax(0,1fr) minmax(0,1fr)'}}><section className="section"><h2>Nový objekt</h2><NewBuilding /></section><section className="section"><h2>Objekty ({buildings.length})</h2><div className="items">{buildings.length===0?<p className="muted">Zatím žádné objekty.</p>:buildings.map(b=><div className="item" key={b.id}><b>{b.name}</b><span className="muted">{b.address}</span></div>)}</div></section></div></>;
}
