// Naplní databázi vymyšlenými ukázkovými daty (npm run db:seed). Smaže stávající záznamy!
import { PrismaClient, type InspectionResult, type TaskStatus } from '@prisma/client';
import data from './seed-data.json';

const prisma = new PrismaClient();
const today = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z');
const day = (n: number | null | undefined) => (n == null ? null : new Date(today.getTime() + n * 86_400_000));

async function main() {
  await prisma.$transaction([
    prisma.inspection.deleteMany(),
    prisma.keySet.deleteMany(),
    prisma.task.deleteMany(),
    prisma.building.deleteMany(),
  ]);
  await prisma.building.createMany({ data: data.buildings });
  await prisma.task.createMany({
    data: data.tasks.map((t) => ({
      buildingId: t.b,
      title: t.title,
      status: t.status as TaskStatus,
      dueAt: day(t.due),
      notes: 'notes' in t ? t.notes : null,
    })),
  });
  await prisma.keySet.createMany({
    data: data.keys.map((k) => ({
      buildingId: k.b,
      code: k.code,
      description: k.description,
      holder: 'holder' in k ? k.holder : null,
      borrowedAt: 'lent' in k ? day(k.lent) : null,
    })),
  });
  await prisma.inspection.createMany({
    data: data.inspections.map((x) => ({
      buildingId: x.b,
      type: x.type,
      inspectedAt: day(x.done)!,
      nextDue: day(x.next),
      result: x.result as InspectionResult,
      notes: 'notes' in x ? x.notes : null,
    })),
  });
  console.log('Hotovo: ukázková data nahrána.');
}

main().finally(() => prisma.$disconnect());
