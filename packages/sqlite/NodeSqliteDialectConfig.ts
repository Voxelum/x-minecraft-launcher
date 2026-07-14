import type { DatabaseSync } from 'node:sqlite'

/**
 * Configuration for {@link NodeSqliteDialect}. The dialect owns a single
 * {@link DatabaseSync} connection created lazily through {@link database}.
 */
export type NodeSqliteDialectConfig = {
  /**
   * Factory that opens (or re-opens) the underlying `node:sqlite` connection.
   * It is called during `init()` and again by the driver's self-heal path when
   * a handle is closed/corrupted, so it must be safe to call multiple times.
   */
  database: () => DatabaseSync
  /**
   * Notified when a query fails with an error the driver decided to surface to
   * the consumer (corrupt file, missing table, unexpected errors). Transient
   * self-healed failures are flagged with `isDisposed` instead.
   */
  onError?: (error: unknown) => void
  /**
   * The on-disk path of the database. Used by the corruption-recovery path to
   * move a malformed file aside before re-opening a fresh one.
   */
  databasePath?: string
}
