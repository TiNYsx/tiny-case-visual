import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { ensureProjectMembership } from '@/lib/permissions';
import { publishProjectEvent } from '@/lib/project-events';

async function getTestCaseProject(testCaseId: string) {
  return prisma.testCase.findUnique({
    where: { id: testCaseId },
    select: { projectId: true },
  });
}

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

    const testCase = await getTestCaseProject(testCaseId);
    if (!testCase) {
      return NextResponse.json({ error: 'Test case not found' }, { status: 404 });
    }

    const access = await ensureProjectMembership(testCase.projectId, session.user.id);
    if (!access) {
      return NextResponse.json({ error: 'Test case not found' }, { status: 404 });
    }

    const comments = await prisma.comment.findMany({
      where: { testCaseId },
      orderBy: { createdAt: 'asc' },
      include: {
        attachments: true,
        user: { select: { id: true, name: true, image: true } },
      },
    });

    return NextResponse.json(comments);
  } catch (error) {
    console.error('Error fetching comments:', error);
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
    const { testCaseId, text, type, attachments } = body;

    if (!testCaseId || !text) {
      return NextResponse.json({ error: 'Test Case ID and text are required' }, { status: 400 });
    }

    const testCase = await getTestCaseProject(testCaseId);
    if (!testCase) {
      return NextResponse.json({ error: 'Test case not found' }, { status: 404 });
    }

    const access = await ensureProjectMembership(testCase.projectId, session.user.id);
    if (!access) {
      return NextResponse.json({ error: 'Test case not found' }, { status: 404 });
    }

    const comment = await prisma.comment.create({
      data: {
        testCaseId,
        userId: session.user.id,
        text,
        type: type || 'comment',
      },
    });

    if (attachments && attachments.length > 0) {
      await prisma.attachment.createMany({
        data: attachments.map((att: { name: string; url: string; type: string }) => ({
          commentId: comment.id,
          name: att.name,
          url: att.url,
          type: att.type,
        })),
      });
    }

    const fullComment = await prisma.comment.findUnique({
      where: { id: comment.id },
      include: {
        attachments: true,
        user: { select: { id: true, name: true, image: true } },
      },
    });

    publishProjectEvent(testCase.projectId, 'comment.created', { testCaseId, commentId: comment.id });
    return NextResponse.json(fullComment);
  } catch (error) {
    console.error('Error creating comment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
