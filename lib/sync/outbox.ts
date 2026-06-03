import "server-only";
import { getDb, nowMs } from "@/lib/sqlite";
import { connectCloudDB } from "@/lib/mongoose";

// Local writes call enqueueOutbox(collection, docId, op, payload). The drain
// loop picks them up and applies them to cloud Mongo as last-write-wins:
//   upsert: replaceOne by _id, no read first.
//   delete: deleteOne by _id.
// Cloud Mongo accepts arbitrary `_id` types — desktop docs use UUID strings.

export type OutboxOp = "upsert" | "delete";

const MAX_ATTEMPTS = 8;
const BATCH = 50;

export function enqueueOutbox(
  collection: string,
  docId: string,
  op: OutboxOp,
  payload: Record<string, unknown>,
): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO sync_outbox (collection, doc_id, op, payload, enqueued_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(collection, docId, op, JSON.stringify(payload), nowMs());
}

export async function drainOutbox(): Promise<{ pushed: number; failed: number }> {
  const conn = await connectCloudDB();
  if (!conn) return { pushed: 0, failed: 0 };
  const cloudDb = conn.connection.db;
  if (!cloudDb) return { pushed: 0, failed: 0 };
  const db = getDb();

  const rows = db
    .prepare(
      `SELECT id, collection, doc_id, op, payload, attempts
       FROM sync_outbox WHERE attempts < ? ORDER BY id ASC LIMIT ?`,
    )
    .all(MAX_ATTEMPTS, BATCH) as Array<{
    id: number;
    collection: string;
    doc_id: string;
    op: string;
    payload: string;
    attempts: number;
  }>;

  let pushed = 0;
  let failed = 0;

  const dropStmt = db.prepare(`DELETE FROM sync_outbox WHERE id = ?`);
  const bumpStmt = db.prepare(
    `UPDATE sync_outbox SET attempts = attempts + 1, last_error = ? WHERE id = ?`,
  );

  for (const row of rows) {
    try {
      const collection = cloudDb.collection(row.collection);
      if (row.op === "delete") {
        await collection.deleteOne({ _id: row.doc_id as unknown as never });
      } else {
        const doc = JSON.parse(row.payload) as Record<string, unknown>;
        doc._id = row.doc_id;
        await collection.replaceOne(
          { _id: row.doc_id as unknown as never },
          doc,
          { upsert: true },
        );
      }
      dropStmt.run(row.id);
      pushed++;
    } catch (err) {
      bumpStmt.run(String(err instanceof Error ? err.message : err), row.id);
      failed++;
    }
  }

  return { pushed, failed };
}
