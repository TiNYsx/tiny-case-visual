import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { publishProjectEvent } from '@/lib/project-events';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; sessionId: string; resultId: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId, sessionId, resultId } = await params;
    const body = await request.json();
    const { name, url, type, size } = body;

    if (!name || !url || !type) {
      return NextResponse.json({ error: 'Evidence name, url, and type are required' }, { status: 400 });
    }

    const stepResult = await prisma.testSessionStepResult.findUnique({
      where: { id: resultId, sessionId },
      include: { session: true },
    });

    if (!stepResult || stepResult.session.projectId !== projectId) {
      return NextResponse.json({ error: 'Step result not found' }, { status: 404 });
    }

    if (stepResult.session.testerId !== session.user.id) {
      return NextResponse.json({ error: 'Only the active tester can attach evidence' }, { status: 403 });
    }

    const evidence = await prisma.testRunEvidence.create({
      data: {
        stepResultId: resultId,
        name,
        url,
        type,
        size,
      },
    });

    publishProjectEvent(projectId, 'session.evidence-added', { sessionId, resultId });
    return NextResponse.json(evidence);
  } catch (error) {
    console.error('Error adding evidence:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
