import { prisma } from "@/lib/prisma";
import type { AuditAction, AuditEntity, Prisma } from "@prisma/client";

interface LogParams {
  userId: string;
  entity: AuditEntity;
  entityId: string;
  action: AuditAction;
  before?: Prisma.InputJsonValue | null;
  after?: Prisma.InputJsonValue | null;
  reason?: string;
}

export async function logAudit({ userId, entity, entityId, action, before, after, reason }: LogParams) {
  await prisma.auditLog.create({
    data: {
      userId,
      entity,
      entityId,
      action,
      before: before ?? undefined,
      after: after ?? undefined,
      reason,
    },
  });
}
