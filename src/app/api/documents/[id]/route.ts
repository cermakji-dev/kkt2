import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUser } from '@/lib/auth';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user?.active) return NextResponse.json({ error: 'Nepřihlášený uživatel' }, { status: 401 });
  const { id } = await params;
  const d = await prisma.buildingDocument.findUnique({ where: { id }, select: { mime: true, data: true, fileName: true } });
  if (!d) return new NextResponse('Nenalezeno', { status: 404 });
  const ascii = d.fileName.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '_');
  return new NextResponse(new Uint8Array(d.data), {
    headers: {
      'Content-Type': d.mime,
      'Content-Disposition': `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(d.fileName)}`,
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
