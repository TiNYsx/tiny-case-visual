import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { ensureProjectMembership, getRunningSession } from '@/lib/permissions';
import { publishProjectEvent } from '@/lib/project-events';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const access = await ensureProjectMembership(id, session.user.id);
    if (!access) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        members: {
          include: { user: { select: { id: true, name: true, email: true, image: true } } },
          orderBy: { createdAt: 'asc' },
        },
        templateSteps: { orderBy: { order: 'asc' } },
        testSessions: {
          where: { status: 'running' },
          include: { tester: { select: { id: true, name: true, email: true, image: true } } },
          take: 1,
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const testCases = await prisma.testCase.findMany({
      where: { projectId: id },
      orderBy: { createdAt: 'asc' },
      include: {
        steps: { orderBy: { order: 'asc' } },
        connectionsAsSource: true,
        connectionsAsTarget: true,
        _count: { select: { comments: true } },
      },
    });

    return NextResponse.json({ ...project, testCases, currentUserRole: access.role, isManager: access.isManager });
  } catch (error) {
    console.error('Error fetching project:', error);
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
    const access = await ensureProjectMembership(id, session.user.id);
    if (!access) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (!access.isManager) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const runningSession = await getRunningSession(id);
    if (runningSession) {
      return NextResponse.json({ error: 'Project is locked while a test is running', runningSession }, { status: 409 });
    }

    const body = await request.json();
    const { name, description } = body;

    const updated = await prisma.project.update({
      where: { id },
      data: { name, description },
    });

    publishProjectEvent(id, 'project.updated', { projectId: id });
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating project:', error);
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
    const access = await ensureProjectMembership(id, session.user.id);
    if (!access) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (!access.isOwner) {
      return NextResponse.json({ error: 'Only the project owner can delete this project' }, { status: 403 });
    }

    await prisma.project.delete({ where: { id } });
    publishProjectEvent(id, 'project.deleted', { projectId: id });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting project:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
