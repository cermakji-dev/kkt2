import type { Priority, TaskStatus } from '@prisma/client';
import { daysUntil } from './format';

export const PRIORITY: Record<Priority, { label: string; tone: string; rank: number }> = {
  HIGH: { label: 'Vysoká', tone: 'bad', rank: 0 },
  MEDIUM: { label: 'Střední', tone: 'warn', rank: 1 },
  LOW: { label: 'Nízká', tone: 'ok', rank: 2 },
  NONE: { label: 'Bez priority', tone: '', rank: 3 },
};

export const STATUS_META: Record<TaskStatus, { label: string; tone: string }> = {
  OPEN: { label: 'K řešení', tone: '' },
  IN_PROGRESS: { label: 'Rozpracováno', tone: 'acc' },
  DONE: { label: 'Hotovo', tone: 'ok' },
};

export type Bucket = 'late' | 'today' | 'week' | 'later' | 'none';
export const BUCKETS: { key: Bucket; label: string }[] = [
  { key: 'late', label: 'Po termínu' },
  { key: 'today', label: 'Dnes' },
  { key: 'week', label: 'Příštích 7 dní' },
  { key: 'later', label: 'Později' },
  { key: 'none', label: 'Bez termínu' },
];

export function bucketOf(dueAt: Date | null): Bucket {
  if (!dueAt) return 'none';
  const d = daysUntil(dueAt);
  if (d < 0) return 'late';
  if (d === 0) return 'today';
  if (d <= 7) return 'week';
  return 'later';
}

/** Lidské vyjádření termínu jako v Asaně: Dnes, Zítra, Po, 3. 11. */
export function dueLabel(dueAt: Date | null): { text: string; tone: string } {
  if (!dueAt) return { text: '', tone: '' };
  const d = daysUntil(dueAt);
  if (d === 0) return { text: 'Dnes', tone: 'ok' };
  if (d === 1) return { text: 'Zítra', tone: 'ok' };
  if (d === -1) return { text: 'Včera', tone: 'bad' };
  if (d < 0) return { text: `${dueAt.getUTCDate()}. ${dueAt.getUTCMonth() + 1}.`, tone: 'bad' };
  if (d < 7) return { text: new Intl.DateTimeFormat('cs-CZ', { weekday: 'short', timeZone: 'UTC' }).format(dueAt), tone: '' };
  return { text: `${dueAt.getUTCDate()}. ${dueAt.getUTCMonth() + 1}.`, tone: '' };
}

export function sortTasks<T extends { priority: Priority; dueAt: Date | null; sortOrder: number; createdAt: Date }>(a: T, b: T) {
  return (
    (a.dueAt?.getTime() ?? Infinity) - (b.dueAt?.getTime() ?? Infinity) ||
    PRIORITY[a.priority].rank - PRIORITY[b.priority].rank ||
    a.sortOrder - b.sortOrder ||
    b.createdAt.getTime() - a.createdAt.getTime()
  );
}
