'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import type { FormState } from '@/app/actions';

const optStr = (max: number) =>
  z.string().trim().max(max).optional().transform((v) => (v ? v : null));

export async function updateMyProfile(_: FormState, fd: FormData): Promise<FormState> {
  const me = await requireUser();
  const p = z.object({ name: optStr(120), phone: optStr(40) }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: 'Neplatné údaje.' };
  await prisma.profile.update({ where: { id: me.id }, data: p.data });
  return { ok: Date.now() };
}

export async function changeMyPassword(_: FormState, fd: FormData): Promise<FormState> {
  await requireUser();
  const p = z
    .object({ password: z.string().min(8).max(72), confirm: z.string() })
    .refine((v) => v.password === v.confirm)
    .safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: 'Hesla se neshodují nebo jsou kratší než 8 znaků.' };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: p.data.password });
  if (error) return { error: 'Heslo se nepodařilo změnit: ' + error.message };
  return { ok: Date.now() };
}
