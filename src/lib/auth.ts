import { cache } from 'react';
import type { Profile, Role } from '@prisma/client';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { e2eUserId } from '@/lib/e2e';

export type CurrentUser = Profile;

/**
 * Přihlášený uživatel s profilem a rolí, nebo null.
 * getClaims() ověří JWT lokálně; profil se při prvním přihlášení založí
 * (první uživatel v systému bez admina se stane adminem).
 * cache() = jedno volání na request.
 */
export const getUser = cache(async (): Promise<CurrentUser | null> => {
  const e2e = e2eUserId();
  if (e2e) return prisma.profile.findUnique({ where: { id: e2e } });
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  if (error || !sub) return null;
  const email = String(data.claims.email ?? '');

  const existing = await prisma.profile.findUnique({ where: { id: sub } });
  if (existing) return existing;

  const admins = await prisma.profile.count({ where: { role: 'ADMIN' } });
  return prisma.profile.upsert({
    where: { id: sub },
    update: {},
    create: { id: sub, email, role: admins === 0 ? 'ADMIN' : 'TECHNIK' },
  });
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getUser();
  if (!user || !user.active) throw new Error('Nepřihlášený nebo deaktivovaný uživatel');
  return user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== 'ADMIN') throw new Error('Jen pro administrátory');
  return user;
}

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'Administrátor',
  TECHNIK: 'Technik',
  REFERENT: 'Referent',
};

export function displayName(p: Pick<Profile, 'name' | 'email'> | null | undefined): string {
  if (!p) return 'Nepřiřazeno';
  return p.name || p.email;
}

/** Iniciály pro avatar. */
export function initials(p: Pick<Profile, 'name' | 'email'>): string {
  const src = (p.name || p.email.split('@')[0]).trim();
  const parts = src.split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}
