import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUser } from '@/lib/auth';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user?.active) return NextResponse.json({ error: 'Nepřihlášený uživatel' }, { status: 401 });
  const { id } = await params;
  const a = await prisma.attachment.findUnique({ where: { id }, select: { mime: true, data: true } });
  if (!a) return new NextResponse('Nenalezeno', { status: 404 });
  return new NextResponse(new Uint8Array(a.data), {
    headers: {
      'Content-Type': a.mime,
      // Přílohy se nemění (nová fotka = nové id), smí se cachovat v prohlížeči.
      'Cache-Control': 'private, max-age=31536000, immutable',
    },
  });
}
