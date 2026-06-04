import "server-only";

// Storage-mode detection.
//
// The desktop (Electron) build runs the Next standalone server with
// SQLITE_DB_PATH set to a writable per-install location (see electron/main.js)
// and is meant to work offline against a local SQLite store. The hosted web
// build has no writable SQLite path — its filesystem is read-only / ephemeral,
// so opening better-sqlite3 there throws SQLITE_CANTOPEN. The web build talks
// straight to cloud Mongo instead and requires a network connection.
//
// Electron is the ONLY context that sets SQLITE_DB_PATH, so its presence is the
// single source of truth for "use the local SQLite store".
export function isDesktop(): boolean {
  return !!process.env.SQLITE_DB_PATH;
}
