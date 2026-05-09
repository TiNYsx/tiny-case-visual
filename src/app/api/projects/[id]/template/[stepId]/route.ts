import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { ensureProjectMembership, getRunningSession } from '@/lib/permissions';
import { publishProjectEvent } from '@/lib/project-events';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string; stepId: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId, stepId } = await params;
    const access = await ensureProjectMembership(projectId, session.user.id);
    if (!access) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const runningSession = await getRunningSession(projectId);
    if (runningSession) {
      return NextResponse.json({ error: 'Template is locked while a test is running', runningSession }, { status: 409 });
    }

    const body = await request.json();
    const { title, instruction, expected, order } = body;

    const step = await prisma.templateStep.update({
      where: { id: stepId, projectId },
      data: { title, instruction, expected, order },
    });

    publishProjectEvent(projectId, 'template.updated', { stepId });
    return NextResponse.json(step);
  } catch (error) {
    console.error('Error updating template step:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; stepId: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId, stepId } = await params;
    const access = await ensureProjectMembership(projectId, session.user.id);
    if (!access) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const runningSession = await getRunningSession(projectId);
    if (runningSession) {
      return NextResponse.json({ error: 'Template is locked while a test is running', runningSession }, { status: 409 });
    }

    await prisma.templateStep.delete({ where: { id: stepId, projectId } });

    const remaining = await prisma.templateStep.findMany({
      where: { projectId },
      orderBy: { order: 'asc' },
    });

    await prisma.$transaction(
      remaining.map((step, index) =>
        prisma.templateStep.update({
          where: { id: step.id },
          data: { order: index },
        })
      )
    );

    publishProjectEvent(projectId, 'template.updated', { stepId });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting template step:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
