'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { METER_KIND } from '@/lib/building-meta';
import { addMonths } from '@/lib/format';
import type { FormState } from '@/app/actions';

const opt = (max: number) => z.string().trim().max(max).optional().transform((v) => (v ? v : null));
const optInt = z.string().optional().transform((v) => (v && /^-?\d+$/.test(v) ? Number.parseInt(v, 10) : null));
const optNum = z.string().optional().transform((v) => (v && !Number.isNaN(Number(v.replace(',', '.'))) ? Number(v.replace(',', '.')) : null));
const optDate = z.string().optional().transform((v) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(v + 'T00:00:00Z') : null));
const refresh = (id: string) => revalidatePath(`/buildings/${id}`);

/** Smí upravovat: admin nebo technik/referent domu. */
async function canEdit(buildingId: string) {
  const me = await requireUser();
  if (me.role === 'ADMIN') return me;
  const b = await prisma.building.findUnique({ where: { id: buildingId }, select: { technicianId: true, referentId: true } });
  if (b && (b.technicianId === me.id || b.referentId === me.id)) return me;
  throw new Error('Tento dům upravuje jeho technik, referent nebo administrátor.');
}

const infoSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  address: z.string().trim().min(1).max(250),
  code: opt(20),
  ico: opt(20),
  svjName: opt(200),
  cadastralArea: opt(120),
  yearBuilt: optInt,
  floors: optInt,
  entrances: optInt,
  units: optInt,
  nonResidential: optInt,
  garages: optInt,
  heating: opt(120),
  notes: opt(4000),
});

export async function updateBuildingInfo(_: FormState, fd: FormData): Promise<FormState> {
  const p = infoSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: 'Zkontrolujte název a adresu domu.' };
  await canEdit(p.data.id);
  const { id, ...data } = p.data;
  await prisma.building.update({
    where: { id },
    data: {
      ...data,
      hasElevator: fd.get('hasElevator') === 'on',
      hasGas: fd.get('hasGas') === 'on',
      hasBoiler: fd.get('hasBoiler') === 'on',
      hasChimney: fd.get('hasChimney') === 'on',
      hasHydrants: fd.get('hasHydrants') === 'on',
    },
  });
  return { ok: Date.now() };
}

const contactSchema = z.object({
  buildingId: z.string().min(1),
  role: z.enum(['PREDSEDA', 'MISTOPREDSEDA', 'CLEN_VYBORU', 'DOMOVNIK', 'SPRAVCE', 'KONTAKT']),
  name: z.string().trim().min(1).max(120),
  phone: opt(40),
  email: opt(120),
  unitLabel: opt(40),
  note: opt(500),
});

export async function addContact(_: FormState, fd: FormData): Promise<FormState> {
  const p = contactSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: 'Vyplňte jméno a roli.' };
  await canEdit(p.data.buildingId);
  await prisma.buildingContact.create({ data: p.data });
  return { ok: Date.now() };
}

export async function deleteContact(fd: FormData) {
  const c = await prisma.buildingContact.findUnique({ where: { id: String(fd.get('id') ?? '') } });
  if (!c) return;
  await canEdit(c.buildingId);
  await prisma.buildingContact.delete({ where: { id: c.id } });
  refresh(c.buildingId);
}

const unitSchema = z.object({
  buildingId: z.string().min(1),
  label: z.string().trim().min(1).max(40),
  type: z.enum(['BYT', 'NEBYT', 'GARAZ', 'SKLEP']),
  floor: optInt,
  area: optNum,
  entrance: opt(20),
  ownerName: opt(160),
  ownerPhone: opt(40),
  ownerEmail: opt(120),
  note: opt(500),
});

export async function addUnit(_: FormState, fd: FormData): Promise<FormState> {
  const p = unitSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: 'Vyplňte číslo jednotky.' };
  await canEdit(p.data.buildingId);
  const exists = await prisma.unit.findUnique({ where: { buildingId_label: { buildingId: p.data.buildingId, label: p.data.label } } });
  if (exists) return { error: `Jednotka ${p.data.label} už v domě je.` };
  await prisma.unit.create({ data: p.data });
  return { ok: Date.now() };
}

export async function deleteUnit(fd: FormData) {
  const u = await prisma.unit.findUnique({ where: { id: String(fd.get('id') ?? '') } });
  if (!u) return;
  await canEdit(u.buildingId);
  await prisma.unit.delete({ where: { id: u.id } });
  refresh(u.buildingId);
}

const meterSchema = z.object({
  buildingId: z.string().min(1),
  kind: z.enum(['SV', 'TUV', 'TEPLO', 'ELEKTRO', 'PLYN', 'RTN']),
  serial: z.string().trim().min(1).max(60),
  unitId: z.string().optional().transform((v) => v || null),
  location: opt(120),
  verifiedUntil: optDate,
  installedAt: optDate,
});

export async function addMeter(_: FormState, fd: FormData): Promise<FormState> {
  const p = meterSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: 'Vyplňte druh a výrobní číslo měřidla.' };
  await canEdit(p.data.buildingId);
  const { installedAt, ...data } = p.data;
  // Bez data ověření se dopočítá z data montáže podle zákona o metrologii.
  const years = METER_KIND[data.kind].verifyYears;
  const verifiedUntil = data.verifiedUntil ?? (installedAt && years ? addMonths(installedAt, years * 12) : null);
  await prisma.meter.create({ data: { ...data, verifiedUntil } });
  return { ok: Date.now() };
}

export async function deleteMeter(fd: FormData) {
  const m = await prisma.meter.findUnique({ where: { id: String(fd.get('id') ?? '') } });
  if (!m) return;
  await canEdit(m.buildingId);
  await prisma.meter.delete({ where: { id: m.id } });
  refresh(m.buildingId);
}

export async function addReading(_: FormState, fd: FormData): Promise<FormState> {
  const me = await requireUser();
  const p = z
    .object({ meterId: z.string().min(1), value: optNum, date: optDate })
    .safeParse(Object.fromEntries(fd));
  if (!p.success || p.data.value == null) return { error: 'Zadejte stav měřidla.' };
  const m = await prisma.meter.findUnique({ where: { id: p.data.meterId }, include: { readings: { orderBy: { date: 'desc' }, take: 1 } } });
  if (!m) return { error: 'Měřidlo neexistuje.' };
  const last = m.readings[0];
  if (last && p.data.value < last.value) return { error: `Stav je nižší než poslední odečet (${last.value}). Zkontrolujte číslo.` };
  await prisma.meterReading.create({ data: { meterId: m.id, value: p.data.value, date: p.data.date ?? new Date(), createdById: me.id } });
  return { ok: Date.now() };
}

const MAX_DOC = 3_800_000;
const DOC_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/plain'];

export async function uploadDocument(_: FormState, fd: FormData): Promise<FormState> {
  const buildingId = String(fd.get('buildingId') ?? '');
  const me = await canEdit(buildingId);
  const file = fd.get('file');
  const category = z.enum(['SMLOUVA', 'REVIZNI_ZPRAVA', 'PROJEKT', 'ZAPIS', 'PASPORT', 'FOTO', 'JINE']).safeParse(fd.get('category'));
  if (!(file instanceof File) || file.size === 0) return { error: 'Vyberte soubor.' };
  if (file.size > MAX_DOC) return { error: 'Soubor je větší než 3,8 MB. Zmenšete ho nebo rozdělte.' };
  if (!DOC_TYPES.includes(file.type)) return { error: 'Podporované jsou PDF, obrázky, Word, Excel a text.' };
  const title = String(fd.get('title') ?? '').trim().slice(0, 200) || file.name;
  await prisma.buildingDocument.create({
    data: {
      buildingId,
      title,
      category: category.success ? category.data : 'JINE',
      fileName: file.name.slice(0, 200),
      mime: file.type,
      size: file.size,
      data: new Uint8Array(await file.arrayBuffer()),
      uploadedById: me.id,
    },
  });
  return { ok: Date.now() };
}

export async function deleteDocument(fd: FormData) {
  const d = await prisma.buildingDocument.findUnique({ where: { id: String(fd.get('id') ?? '') }, select: { id: true, buildingId: true } });
  if (!d) return;
  await canEdit(d.buildingId);
  await prisma.buildingDocument.delete({ where: { id: d.id } });
  refresh(d.buildingId);
}
