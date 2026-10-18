'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { adminClient } from '@/lib/supabase/admin';
import type { FormState } from '@/app/actions';

const role = z.enum(['ADMIN', 'TECHNIK', 'REFERENT']);
const optStr = (max: number) =>
  z.string().trim().max(max).optional().transform((v) => (v ? v : null));

const NO_KEY = 'Chybí SUPABASE_SECRET_KEY ve Vercelu, bez něj nejde zakládat účty ani měnit hesla.';

const createSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  name: optStr(120),
  role,
  password: z.string().min(8).max(72),
});

export async function createUser(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const p = createSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: 'Zadejte platný e-mail, roli a heslo (aspoň 8 znaků).' };
  const admin = adminClient();
  if (!admin) return { error: NO_KEY };

  const exists = await prisma.profile.findUnique({ where: { email: p.data.email } });
  if (exists) return { error: 'Uživatel s tímto e-mailem už existuje.' };

  const { data, error } = await admin.auth.admin.createUser({
    email: p.data.email,
    password: p.data.password,
    email_confirm: true,
  });
  if (error || !data.user) return { error: 'Účet se nepodařilo založit: ' + (error?.message ?? 'neznámá chyba') };

  await prisma.profile.create({
    data: { id: data.user.id, email: p.data.email, name: p.data.name, role: p.data.role },
  });
  revalidatePath('/users');
  return { ok: Date.now() };
}

const updateSchema = z.object({
  id: z.string().min(1),
  name: optStr(120),
  phone: optStr(40),
  role,
  active: z.string().optional().transform((v) => v === 'on'),
});

export async function updateUser(_: FormState, fd: FormData): Promise<FormState> {
  const me = await requireAdmin();
  const p = updateSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: 'Neplatné údaje.' };
  if (p.data.id === me.id && (p.data.role !== 'ADMIN' || !p.data.active)) {
    return { error: 'Sami sobě nemůžete odebrat roli administrátora ani účet deaktivovat.' };
  }
  await prisma.profile.update({
    where: { id: p.data.id },
    data: { name: p.data.name, phone: p.data.phone, role: p.data.role, active: p.data.active },
  });
  // Deaktivovaný uživatel se už nepřihlásí.
  const admin = adminClient();
  if (admin && !p.data.id.startsWith('demo-')) {
    await admin.auth.admin.updateUserById(p.data.id, { ban_duration: p.data.active ? 'none' : '876000h' });
  }
  revalidatePath('/', 'layout');
  return { ok: Date.now() };
}

const pwSchema = z.object({ id: z.string().min(1), password: z.string().min(8).max(72) });

export async function setPassword(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const p = pwSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: 'Heslo musí mít aspoň 8 znaků.' };
  if (p.data.id.startsWith('demo-')) return { error: 'Ukázkový kolega nemá přihlašovací účet.' };
  const admin = adminClient();
  if (!admin) return { error: NO_KEY };
  const { error } = await admin.auth.admin.updateUserById(p.data.id, { password: p.data.password });
  if (error) return { error: 'Heslo se nepodařilo změnit: ' + error.message };
  return { ok: Date.now() };
}
