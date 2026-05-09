import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { TestSessionStatus } from '@prisma/client';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { ensureProjectMembership } from '@/lib/permissions';
import { publishProjectEvent } from '@/lib/project-events';

async function getSessionAccess(projectId: string, appUserId: string, sessionId: string) {
  const access = await ensureProjectMembership(projectId, appUserId);
  if (!access) return { error: NextResponse.json({ error: 'Project not found' }, { status: 404 }) };

  const testSession = await prisma.testSession.findUnique({
    where: { id: sessionId },
    include: {
      tester: { select: { id: true, name: true, email: true, image: true } },
      stepResults: {
        orderBy: { order: 'asc' },
        include: { templateStep: true, evidence: true },
      },
    },
  });

  if (!testSession || testSession.projectId !== projectId) {
    return { error: NextResponse.json({ error: 'Test session not found' }, { status: 404 }) };
  }

  return { access, testSession };
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; sessionId: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId, sessionId } = await params;
    const result = await getSessionAccess(projectId, session.user.id, sessionId);
    if ('error' in result) return result.error;

    if (result.testSession.status !== TestSessionStatus.running) {
      return NextResponse.json({ error: 'Test session is not running' }, { status: 409 });
    }

    if (result.testSession.testerId !== session.user.id) {
      return NextResponse.json({ error: 'Only the active tester can update this session' }, { status: 403 });
    }

    const body = await request.json();
    const { stepResults, notes } = body;

    const updated = await prisma.$transaction(async (tx) => {
      if (typeof notes === 'string') {
        await tx.testSession.update({ where: { id: sessionId }, data: { notes } });
      }

      if (Array.isArray(stepResults)) {
        for (const step of stepResults) {
          await tx.testSessionStepResult.update({
            where: { id: step.id, sessionId },
            data: {
              status: step.status,
              notes: step.notes,
              actualResult: step.actualResult,
              changedDetails: step.changedDetails,
            },
          });
        }
      }

      return tx.testSession.findUnique({
        where: { id: sessionId },
        include: {
          tester: { select: { id: true, name: true, email: true, image: true } },
          stepResults: {
            orderBy: { order: 'asc' },
            include: { templateStep: true, evidence: true },
          },
        },
      });
    });

    publishProjectEvent(projectId, 'session.updated', { sessionId });
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating test session:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; sessionId: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId, sessionId } = await params;
    const result = await getSessionAccess(projectId, session.user.id, sessionId);
    if ('error' in result) return result.error;

    const body = await request.json().catch(() => ({}));
    const action = body.action;

    if (result.testSession.status !== TestSessionStatus.running) {
      return NextResponse.json({ error: 'Test session is not running' }, { status: 409 });
    }

    if (action === 'finish') {
      if (result.testSession.testerId !== session.user.id && !result.access.isManager) {
        return NextResponse.json({ error: 'Only the active tester or a manager can finish this session' }, { status: 403 });
      }

      const updated = await prisma.testSession.update({
        where: { id: sessionId },
        data: {
          status: TestSessionStatus.completed,
          endedAt: new Date(),
          notes: body.notes,
        },
        include: {
          tester: { select: { id: true, name: true, email: true, image: true } },
          stepResults: {
            orderBy: { order: 'asc' },
            include: { templateStep: true, evidence: true },
          },
        },
      });

      publishProjectEvent(projectId, 'session.completed', { sessionId });
      return NextResponse.json(updated);
    }

    if (action === 'stop') {
      if (!result.access.isManager) {
        return NextResponse.json({ error: 'Only project managers can stop another active test' }, { status: 403 });
      }

      const updated = await prisma.testSession.update({
        where: { id: sessionId },
        data: {
          status: TestSessionStatus.stopped,
          endedAt: new Date(),
          stoppedById: session.user.id,
          notes: body.notes,
        },
        include: {
          tester: { select: { id: true, name: true, email: true, image: true } },
          stoppedBy: { select: { id: true, name: true, email: true, image: true } },
          stepResults: {
            orderBy: { order: 'asc' },
            include: { templateStep: true, evidence: true },
          },
        },
      });

      publishProjectEvent(projectId, 'session.stopped', { sessionId });
      return NextResponse.json(updated);
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Error changing test session:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; sessionId: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId, sessionId } = await params;
    const result = await getSessionAccess(projectId, session.user.id, sessionId);
    if ('error' in result) return result.error;

    if (result.testSession.status === TestSessionStatus.running && !result.access.isManager) {
      return NextResponse.json({ error: 'Only project managers can remove a running test' }, { status: 403 });
    }

    await prisma.testSession.delete({ where: { id: sessionId } });
    publishProjectEvent(projectId, 'session.deleted', { sessionId });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting test session:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
