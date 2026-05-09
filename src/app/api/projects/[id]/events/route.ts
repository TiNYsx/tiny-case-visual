import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ensureProjectMembership } from '@/lib/permissions';
import { subscribeProjectEvents } from '@/lib/project-events';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: projectId } = await params;
  const access = await ensureProjectMembership(projectId, session.user.id);
  if (!access) {
    return Response.json({ error: 'Project not found' }, { status: 404 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      send({ projectId, type: 'connected', createdAt: new Date().toISOString() });
      const unsubscribe = subscribeProjectEvents(projectId, send);
      const heartbeat = setInterval(() => {
        send({ projectId, type: 'heartbeat', createdAt: new Date().toISOString() });
      }, 25000);

      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        unsubscribe();
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
