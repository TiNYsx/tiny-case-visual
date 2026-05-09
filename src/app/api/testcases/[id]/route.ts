import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { ensureProjectMembership, getRunningSession } from '@/lib/permissions';
import { publishProjectEvent } from '@/lib/project-events';

async function getTestCaseWithAccess(testCaseId: string, userId: string) {
  const testCase = await prisma.testCase.findUnique({
    where: { id: testCaseId },
    include: {
      steps: { orderBy: { order: 'asc' } },
      connectionsAsSource: true,
      connectionsAsTarget: true,
      _count: { select: { comments: true } },
    },
  });

  if (!testCase) return null;
  const access = await ensureProjectMembership(testCase.projectId, userId);
  if (!access) return null;
  return { testCase, access };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const result = await getTestCaseWithAccess(id, session.user.id);
    if (!result) {
      return NextResponse.json({ error: 'Test case not found' }, { status: 404 });
    }

    return NextResponse.json(result.testCase);
  } catch (error) {
    console.error('Error fetching test case:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const result = await getTestCaseWithAccess(id, session.user.id);
    if (!result) {
      return NextResponse.json({ error: 'Test case not found' }, { status: 404 });
    }

    const runningSession = await getRunningSession(result.testCase.projectId);
    if (runningSession) {
      return NextResponse.json({ error: 'Project is locked while a test is running', runningSession }, { status: 409 });
    }

    const body = await request.json();
    const { title, description, testCaseType, testData, expectedResult, positionX, positionY, status, steps, connections } = body;

    const testCase = await prisma.testCase.update({
      where: { id },
      data: {
        title,
        description,
        testCaseType,
        testData,
        expectedResult,
        positionX,
        positionY,
        status,
        updatedById: session.user.id,
      },
    });

    if (steps) {
      await prisma.testCaseStep.deleteMany({ where: { testCaseId: id } });
      if (steps.length > 0) {
        await prisma.testCaseStep.createMany({
          data: steps.map((step: { text: string; imageUrl?: string }, index: number) => ({
            testCaseId: id,
            text: step.text,
            imageUrl: step.imageUrl,
            order: index,
          })),
        });
      }
    }

    if (connections) {
      await prisma.testCaseConnection.deleteMany({ where: { sourceId: id } });
      if (connections.length > 0) {
        await prisma.testCaseConnection.createMany({
          data: connections.map((conn: { targetId: string }) => ({
            sourceId: id,
            targetId: conn.targetId,
          })),
          skipDuplicates: true,
        });
      }
    }

    const fullTestCase = await prisma.testCase.findUnique({
      where: { id: testCase.id },
      include: {
        steps: { orderBy: { order: 'asc' } },
        connectionsAsSource: true,
        connectionsAsTarget: true,
        _count: { select: { comments: true } },
      },
    });

    publishProjectEvent(result.testCase.projectId, 'testcase.updated', { testCaseId: id });
    return NextResponse.json(fullTestCase);
  } catch (error) {
    console.error('Error updating test case:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const result = await getTestCaseWithAccess(id, session.user.id);
    if (!result) {
      return NextResponse.json({ error: 'Test case not found' }, { status: 404 });
    }

    const runningSession = await getRunningSession(result.testCase.projectId);
    if (runningSession) {
      return NextResponse.json({ error: 'Project is locked while a test is running', runningSession }, { status: 409 });
    }

    await prisma.testCase.delete({ where: { id } });
    publishProjectEvent(result.testCase.projectId, 'testcase.deleted', { testCaseId: id });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting test case:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
