import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const testCase = await prisma.testCase.findUnique({
      where: { id },
      include: {
        steps: { orderBy: { order: 'asc' } },
        connectionsAsSource: true,
        connectionsAsTarget: true,
        _count: { select: { comments: true } },
      },
    });

    if (!testCase) {
      return NextResponse.json({ error: 'Test case not found' }, { status: 404 });
    }

    return NextResponse.json(testCase);
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
    const body = await request.json();
    const { title, description, testCaseType, testData, expectedResult, positionX, positionY, steps, connections } = body;

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
        updatedById: session.user.id,
      },
    });

    if (steps !== undefined) {
      await prisma.testCaseStep.deleteMany({ where: { testCaseId: id } });
      if (steps.length > 0) {
        await prisma.testCaseStep.createMany({
          data: steps.map((s: { text: string; imageUrl?: string }, i: number) => ({
            testCaseId: id,
            text: s.text,
            imageUrl: s.imageUrl,
            order: i,
          })),
        });
      }
    }

    if (connections !== undefined) {
      await prisma.testCaseConnection.deleteMany({ where: { sourceId: id } });
      if (connections.length > 0) {
        await prisma.testCaseConnection.createMany({
          data: connections.map((conn: { targetId: string }) => ({
            sourceId: id,
            targetId: conn.targetId,
          })),
        });
      }
    }

    const fullTestCase = await prisma.testCase.findUnique({
      where: { id },
      include: {
        steps: { orderBy: { order: 'asc' } },
        connectionsAsSource: true,
        connectionsAsTarget: true,
        _count: { select: { comments: true } },
      },
    });

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
    await prisma.testCaseConnection.deleteMany({ 
      where: { OR: [{ sourceId: id }, { targetId: id }] } 
    });
    await prisma.testCaseStep.deleteMany({ where: { testCaseId: id } });
    await prisma.comment.deleteMany({ where: { testCaseId: id } });
    await prisma.testCase.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting test case:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}