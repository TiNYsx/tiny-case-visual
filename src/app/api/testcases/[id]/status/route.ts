import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    if (!['pass', 'fail'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const testCase = await prisma.testCase.update({
      where: { id },
      data: {
        status,
        checkedAt: new Date(),
        checkedById: session.user.id,
      },
    });

    await prisma.testCaseCheck.create({
      data: {
        testCaseId: id,
        userId: session.user.id,
        status,
      },
    });

    return NextResponse.json(testCase);
  } catch (error) {
    console.error('Error updating status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}