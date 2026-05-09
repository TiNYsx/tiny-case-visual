import { NextRequest, NextResponse } from 'next/server';
import { existsSync, readFileSync, statSync } from 'fs';
import { resolve, join } from 'path';

const contentTypes: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  txt: 'text/plain; charset=utf-8',
  md: 'text/markdown; charset=utf-8',
  json: 'application/json; charset=utf-8',
  pdf: 'application/pdf',
};

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const relativePath = url.pathname.replace('/api/uploads/', '');
  const uploadRoot = resolve(process.env.UPLOAD_DIR || './uploads');
  const filePath = resolve(join(uploadRoot, relativePath));

  if (!filePath.startsWith(uploadRoot)) {
    return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
  }

  if (!existsSync(filePath)) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  const fileBuffer = readFileSync(filePath);
  const stat = statSync(filePath);
  const extension = filePath.split('.').pop()?.toLowerCase() || '';

  return new NextResponse(fileBuffer, {
    headers: {
      'Content-Length': String(stat.size),
      'Content-Type': contentTypes[extension] || 'application/octet-stream',
    },
  });
}
