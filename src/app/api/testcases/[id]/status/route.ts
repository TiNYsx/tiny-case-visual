import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { ensureProjectMembership } from '@/lib/permissions';
import { publishProjectEvent } from '@/lib/project-events';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    if (!['pass', 'fail', 'pending'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const existing = await prisma.testCase.findUnique({
      where: { id },
      select: { projectId: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Test case not found' }, { status: 404 });
    }

    const access = await ensureProjectMembership(existing.projectId, session.user.id);
    if (!access) {
      return NextResponse.json({ error: 'Test case not found' }, { status: 404 });
    }

    const testCase = await prisma.testCase.update({
      where: { id },
      data: {
        status,
        checkedAt: status === 'pending' ? null : new Date(),
        checkedById: status === 'pending' ? null : session.user.id,
      },
    });

    if (status !== 'pending') {
      await prisma.testCaseCheck.create({
        data: {
          testCaseId: id,
          userId: session.user.id,
          status,
        },
      });
    }

    publishProjectEvent(existing.projectId, 'testcase.status-updated', { testCaseId: id, status });
    return NextResponse.json(testCase);
  } catch (error) {
    console.error('Error updating status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
