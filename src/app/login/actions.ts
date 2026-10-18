'use server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const schema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
  next: z.string().optional(),
});

export type LoginState = { error?: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    next: formData.get('next') ?? undefined,
  });
  if (!parsed.success) return { error: 'Zadejte platný e-mail a heslo.' };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) return { error: 'Nesprávný e-mail nebo heslo.' };

  // Přesměrovat jen na interní cestu.
  const next = parsed.data.next;
  redirect(next && next.startsWith('/') && !next.startsWith('//') ? next : '/');
}
