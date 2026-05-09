import { ProjectRole, TestSessionStatus } from '@prisma/client';
import prisma from '@/lib/prisma';

export type ProjectAccess = {
  projectId: string;
  userId: string;
  role: ProjectRole;
  isOwner: boolean;
  isManager: boolean;
};

export async function ensureProjectMembership(projectId: string, userId: string): Promise<ProjectAccess | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      createdById: true,
      members: {
        where: { userId },
        select: { role: true },
        take: 1,
      },
    },
  });

  if (!project) return null;

  let role = project.members[0]?.role;
  if (!role && project.createdById === userId) {
    role = ProjectRole.owner;
    await prisma.projectMember.upsert({
      where: { projectId_userId: { projectId, userId } },
      update: { role },
      create: { projectId, userId, role },
    });
  }

  if (!role) return null;

  return {
    projectId,
    userId,
    role,
    isOwner: role === ProjectRole.owner,
    isManager: role === ProjectRole.owner || role === ProjectRole.manager,
  };
}

export async function getRunningSession(projectId: string) {
  return prisma.testSession.findFirst({
    where: { projectId, status: TestSessionStatus.running },
    include: {
      tester: { select: { id: true, name: true, email: true, image: true } },
      stepResults: {
        orderBy: { order: 'asc' },
        include: {
          templateStep: true,
          testCase: true,
          evidence: true,
        },
      },
    },
  } as any);
}

export async function projectHasRunningSession(projectId: string) {
  const running = await prisma.testSession.findFirst({
    where: { projectId, status: TestSessionStatus.running },
    select: { id: true },
  });
  return Boolean(running);
}

export async function canMutateProjectTemplate(projectId: string) {
  return !(await projectHasRunningSession(projectId));
}
