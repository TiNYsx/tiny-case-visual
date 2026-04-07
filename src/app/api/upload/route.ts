import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const maxSize = parseInt(process.env.MAX_FILE_SIZE || '10485760');
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File too large' }, { status: 400 });
    }

    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    const ext = file.name.split('.').pop() || '';
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
    const uploadPath = join(uploadDir, 'testcases', uniqueName);

    await mkdir(uploadDir, { recursive: true });
    await mkdir(join(uploadDir, 'testcases'), { recursive: true });

    const buffer = await file.arrayBuffer();
    await writeFile(uploadPath, Buffer.from(buffer));

    const fileUrl = `/uploads/testcases/${uniqueName}`;
    const fileType = file.type.startsWith('image/') ? 'image' : 'log';

    return NextResponse.json({
      url: fileUrl,
      name: file.name,
      type: fileType,
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}