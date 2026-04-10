import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    const testCases = await prisma.testCase.findMany({
      where: { projectId },
      include: {
        steps: { orderBy: { order: 'asc' } },
        connectionsAsSource: true,
        connectionsAsTarget: true,
        _count: { select: { comments: true } },
      },
    });

    return NextResponse.json(testCases);
  } catch (error) {
    console.error('Error fetching test cases:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { projectId, title, description, testCaseType, testData, expectedResult, positionX, positionY, steps, connections } = body;

    if (!projectId || !title) {
      return NextResponse.json({ error: 'Project ID and title are required' }, { status: 400 });
    }

    const testCase = await prisma.testCase.create({
      data: {
        projectId,
        title,
        description,
        testCaseType,
        testData,
        expectedResult,
        positionX: positionX ?? 100,
        positionY: positionY ?? 100,
        createdById: session.user.id,
        updatedById: session.user.id,
      },
    });

    if (steps?.length) {
      await prisma.testCaseStep.createMany({
        data: steps.map((step: { text: string; imageUrl?: string }, index: number) => ({
          testCaseId: testCase.id,
          text: step.text,
          imageUrl: step.imageUrl,
          order: index,
        })),
      });
    }

    if (connections?.length) {
      await prisma.testCaseConnection.createMany({
        data: connections.map((conn: { targetId: string }) => ({
          sourceId: testCase.id,
          targetId: conn.targetId,
        })),
      });
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

    return NextResponse.json(fullTestCase);
  } catch (error) {
    console.error('Error creating test case:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}