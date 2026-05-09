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

    const { id: projectId } = await params;
    const access = await ensureProjectMembership(projectId, session.user.id);
    if (!access) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const steps = await prisma.templateStep.findMany({
      where: { projectId },
      orderBy: { order: 'asc' },
    });

    return NextResponse.json(steps);
  } catch (error) {
    console.error('Error fetching template steps:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId } = await params;
    const access = await ensureProjectMembership(projectId, session.user.id);
    if (!access) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const runningSession = await getRunningSession(projectId);
    if (runningSession) {
      return NextResponse.json({ error: 'Template is locked while a test is running', runningSession }, { status: 409 });
    }

    const body = await request.json();
    const { title, instruction, expected } = body;

    if (!title || !instruction) {
      return NextResponse.json({ error: 'Title and instruction are required' }, { status: 400 });
    }

    const count = await prisma.templateStep.count({ where: { projectId } });
    const step = await prisma.templateStep.create({
      data: {
        projectId,
        title,
        instruction,
        expected,
        order: count,
      },
    });

    publishProjectEvent(projectId, 'template.updated', { stepId: step.id });
    return NextResponse.json(step);
  } catch (error) {
    console.error('Error creating template step:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
