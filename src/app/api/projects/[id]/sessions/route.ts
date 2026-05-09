import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { StepResultStatus, TestSessionStatus } from '@prisma/client';
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

    const runningSession = await getRunningSession(projectId);
    const history = await prisma.testSession.findMany({
      where: { projectId, status: { not: TestSessionStatus.running } },
      orderBy: { startedAt: 'desc' },
      include: {
        tester: { select: { id: true, name: true, email: true, image: true } },
        stoppedBy: { select: { id: true, name: true, email: true, image: true } },
        stepResults: {
          orderBy: { order: 'asc' },
          include: {
            templateStep: true,
            evidence: true,
          },
        },
      },
      take: 50,
    });

    return NextResponse.json({ runningSession, history });
  } catch (error) {
    console.error('Error fetching test sessions:', error);
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

    const body = await request.json().catch(() => ({}));
    const { title } = body;

    const created = await prisma.$transaction(async (tx) => {
      const existing = await tx.testSession.findFirst({
        where: { projectId, status: TestSessionStatus.running },
        include: { tester: { select: { id: true, name: true, email: true, image: true } } },
      });

      if (existing) return { existing };

      const templateSteps = await tx.templateStep.findMany({
        where: { projectId },
        orderBy: { order: 'asc' },
      });

      if (templateSteps.length === 0) {
        return { error: 'Create at least one template step before starting a test' };
      }

      const newSession = await tx.testSession.create({
        data: {
          projectId,
          testerId: session.user.id,
          title,
          stepResults: {
            create: templateSteps.map((step) => ({
              templateStepId: step.id,
              userId: session.user.id,
              status: StepResultStatus.pending,
              order: step.order,
            })),
          },
        },
        include: {
          tester: { select: { id: true, name: true, email: true, image: true } },
          stepResults: {
            orderBy: { order: 'asc' },
            include: { templateStep: true, evidence: true },
          },
        },
      });

      return { newSession };
    });

    if ('error' in created) {
      return NextResponse.json({ error: created.error }, { status: 400 });
    }

    if ('existing' in created) {
      return NextResponse.json({ error: 'A test is already running', runningSession: created.existing }, { status: 409 });
    }

    publishProjectEvent(projectId, 'session.started', { sessionId: created.newSession.id });
    return NextResponse.json(created.newSession);
  } catch (error) {
    console.error('Error starting test session:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
