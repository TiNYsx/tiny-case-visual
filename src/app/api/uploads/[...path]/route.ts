import { NextRequest, NextResponse } from 'next/server';
import { existsSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/uploads', '');
  const filePath = join(process.cwd(), 'uploads', path);

  if (!existsSync(filePath)) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  const fileBuffer = readFileSync(filePath);
  const stat = statSync(filePath);
  
  return new NextResponse(fileBuffer, {
    headers: {
      'Content-Length': String(stat.size),
      'Content-Type': 'application/octet-stream',
    },
  });
}