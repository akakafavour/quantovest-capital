import { getDb } from "@/lib/db";
import { auditLog } from "@/db/schema";

export interface AuditEvent {
  actorId: string;
  action: string;
  targetType: string;
  targetId: string | number;
  details?: Record<string, unknown>;
  timestamp: Date;
}

export async function logAuditEvent(
  actorId: string,
  action: string,
  targetType: string,
  targetId: string | number,
  details?: Record<string, unknown>
): Promise<void> {
  const event: AuditEvent = {
    actorId,
    action,
    targetType,
    targetId,
    details,
    timestamp: new Date(),
  };

  // Persist to the database for a durable audit trail.
  try {
    const db = getDb();
    if (db) {
      await db.insert(auditLog).values({
        actorId: event.actorId,
        action: event.action,
        targetType: event.targetType,
        targetId: String(event.targetId),
        details: event.details ?? null,
      });
    }
  } catch (error) {
    // Never let audit logging crash the business operation.
    console.error("[AUDIT] Failed to persist audit event", error instanceof Error ? error.message : error);
  }

  // Also log to console for development visibility.
  console.log("[AUDIT]", JSON.stringify(event));
}
