import Link from 'next/link';
import { prisma } from '@/lib/prisma';
export const dynamic = 'force-dynamic';
export default async function Home() {
 const [buildings,tasks,keys,inspections] = await Promise.all([prisma.building.count(),prisma.task.count({where:{status:{not:'DONE'}}}),prisma.keySet.count(),prisma.inspection.count()]);
 return <><h1>Přehled technika</h1><p className="muted">Vítejte v interním systému iSYS.</p><div className="cards"><div className="card">Spravované objekty<strong>{buildings}</strong></div><div className="card">Otevřené úkoly<strong>{tasks}</strong></div><div className="card">Svazky klíčů<strong>{keys}</strong></div><div className="card">Záznamy kontrol<strong>{inspections}</strong></div></div><div className="section"><h2>Rychlý přístup</h2><p><Link href="/buildings">Otevřít evidenci objektů →</Link></p><p className="muted">Další moduly doplníme v následujících verzích.</p></div></>;
}
