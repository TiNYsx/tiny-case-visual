import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { title, description, parentId, steps } = body;

    const testCase = await prisma.testCase.update({
      where: { id },
      data: {
        title,
        description,
        parentId: parentId || null,
        updatedById: session.user.id,
      },
    });

    if (steps) {
      await prisma.testCaseStep.deleteMany({ where: { testCaseId: id } });
      if (steps.length > 0) {
        await prisma.testCaseStep.createMany({
          data: steps.map((s: { text: string; imageUrl?: string }, i: number) => ({
            testCaseId: id,
            text: s.text,
            imageUrl: s.imageUrl,
            order: i,
          })),
        });
      }
    }

    return NextResponse.json(testCase);
  } catch (error) {
    console.error('Error updating test case:', error);
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
    await prisma.testCaseStep.deleteMany({ where: { testCaseId: id } });
    await prisma.comment.deleteMany({ where: { testCaseId: id } });
    await prisma.testCase.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting test case:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}