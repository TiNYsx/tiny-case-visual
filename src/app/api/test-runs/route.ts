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
    const testCaseId = searchParams.get('testCaseId');

    if (!testCaseId) {
      return NextResponse.json({ error: 'Test Case ID is required' }, { status: 400 });
    }

    const testRuns = await prisma.testCaseCheck.findMany({
      where: { testCaseId },
      orderBy: { checkedAt: 'desc' },
      include: {
        user: {
          select: { id: true, name: true, image: true },
        },
        comments: {
          include: {
            attachments: true,
            user: {
              select: { id: true, name: true, image: true },
            },
          },
        },
      },
    });

    return NextResponse.json(testRuns);
  } catch (error) {
    console.error('Error fetching test runs:', error);
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
    const { testCaseId, status, stepResults, notes, testData, actualResult, testCaseType } = body;

    if (!testCaseId || !status) {
      return NextResponse.json({ error: 'Test Case ID and status are required' }, { status: 400 });
    }

    const testRun = await prisma.testCaseCheck.create({
      data: {
        testCaseId,
        userId: session.user.id,
        status,
        stepResults,
        notes,
        testData,
        actualResult,
      },
    });

    if (testCaseType) {
      await prisma.testCase.update({
        where: { id: testCaseId },
        data: { testCaseType },
      });
    }

    return NextResponse.json(testRun);
  } catch (error) {
    console.error('Error creating test run:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}