import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { ensureProjectMembership, getRunningSession } from '@/lib/permissions';
import { publishProjectEvent } from '@/lib/project-events';

async function getConnectionAccess(sourceId: string, targetId: string, userId: string) {
  const [source, target] = await Promise.all([
    prisma.testCase.findUnique({ where: { id: sourceId }, select: { id: true, projectId: true } }),
    prisma.testCase.findUnique({ where: { id: targetId }, select: { id: true, projectId: true } }),
  ]);

  if (!source || !target || source.projectId !== target.projectId) return null;
  const access = await ensureProjectMembership(source.projectId, userId);
  if (!access) return null;
  return { projectId: source.projectId };
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { sourceId, targetId } = body;

    if (!sourceId || !targetId) {
      return NextResponse.json({ error: 'Source and target IDs are required' }, { status: 400 });
    }

    const access = await getConnectionAccess(sourceId, targetId, session.user.id);
    if (!access) {
      return NextResponse.json({ error: 'Connection target not found' }, { status: 404 });
    }

    const runningSession = await getRunningSession(access.projectId);
    if (runningSession) {
      return NextResponse.json({ error: 'Project is locked while a test is running', runningSession }, { status: 409 });
    }

    const connection = await prisma.testCaseConnection.create({
      data: { sourceId, targetId },
    });

    publishProjectEvent(access.projectId, 'connection.created', { sourceId, targetId });
    return NextResponse.json(connection);
  } catch (error: unknown) {
    if (typeof error === 'object' && error && 'code' in error && error.code === 'P2002') {
      return NextResponse.json({ error: 'Connection already exists' }, { status: 400 });
    }
    console.error('Error creating connection:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const sourceId = searchParams.get('sourceId');
    const targetId = searchParams.get('targetId');

    if (!sourceId || !targetId) {
      return NextResponse.json({ error: 'Source and target IDs are required' }, { status: 400 });
    }

    const access = await getConnectionAccess(sourceId, targetId, session.user.id);
    if (!access) {
      return NextResponse.json({ error: 'Connection target not found' }, { status: 404 });
    }

    const runningSession = await getRunningSession(access.projectId);
    if (runningSession) {
      return NextResponse.json({ error: 'Project is locked while a test is running', runningSession }, { status: 409 });
    }

    await prisma.testCaseConnection.deleteMany({ where: { sourceId, targetId } });
    publishProjectEvent(access.projectId, 'connection.deleted', { sourceId, targetId });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting connection:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
