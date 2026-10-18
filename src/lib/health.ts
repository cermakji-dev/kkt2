import { daysUntil, latestPerType } from './format';

type Input = {
  tasks: { status: string; dueAt: Date | null; priority?: string }[];
  inspections: { buildingId: string; type: string; inspectedAt: Date; nextDue: Date | null; result: string }[];
};

export type Health = { tone: 'ok' | 'warn' | 'bad'; label: string; reasons: string[] };

/** Souhrnný „zdravotní stav“ objektu pro rychlou orientaci. */
export function buildingHealth({ tasks, inspections }: Input): Health {
  const open = tasks.filter((t) => t.status !== 'DONE');
  const lateTasks = open.filter((t) => t.dueAt && daysUntil(t.dueAt) < 0).length;
  const latest = latestPerType(inspections);
  const lateInsp = latest.filter((x) => x.nextDue && daysUntil(x.nextDue) < 0).length;
  const soonInsp = latest.filter((x) => x.nextDue && daysUntil(x.nextDue) >= 0 && daysUntil(x.nextDue) <= 30).length;
  const defects = latest.filter((x) => x.result === 'DEFECT').length;
  const high = open.filter((t) => t.priority === 'HIGH').length;
  const reasons: string[] = [];
  if (lateInsp) reasons.push(`${lateInsp} ${lateInsp === 1 ? 'revize' : 'revize'} po termínu`);
  if (lateTasks) reasons.push(`${lateTasks} ${lateTasks === 1 ? 'úkol' : lateTasks < 5 ? 'úkoly' : 'úkolů'} po termínu`);
  if (defects) reasons.push(`${defects} ${defects === 1 ? 'závada' : defects < 5 ? 'závady' : 'závad'} z kontrol`);
  if (reasons.length) return { tone: 'bad', label: 'Vyžaduje pozornost', reasons };
  if (soonInsp) reasons.push(`${soonInsp} ${soonInsp === 1 ? 'kontrola' : 'kontroly'} do 30 dní`);
  if (high) reasons.push(`${high} ${high === 1 ? 'důležitý úkol' : 'důležité úkoly'}`);
  if (reasons.length) return { tone: 'warn', label: 'Brzy na řadě', reasons };
  return { tone: 'ok', label: 'V pořádku', reasons: ['Nic nehoří'] };
}
