import fs from "node:fs"
import path from "node:path"
import Database from "better-sqlite3"
import { databasePath } from "@/lib/env"
import type { AccountRecord, AppSettings, DashboardData, PingRunRecord, ProjectRecord } from "@/lib/types"

type Db = Database.Database

declare global {
  var __supaactionDb: Db | undefined
}

function migrate(database: Db) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      encrypted_token TEXT NOT NULL,
      token_hint TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'connected',
      last_synced_at TEXT,
      last_error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS projects (
      ref TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      organization_id TEXT,
      organization_slug TEXT,
      region TEXT,
      remote_status TEXT NOT NULL DEFAULT 'UNKNOWN',
      enabled INTEGER NOT NULL DEFAULT 1,
      last_ping_at TEXT,
      last_ping_status TEXT,
      last_latency_ms INTEGER,
      last_http_status INTEGER,
      last_error TEXT,
      next_ping_at TEXT,
      remote_created_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ping_runs (
      id TEXT PRIMARY KEY,
      project_ref TEXT NOT NULL REFERENCES projects(ref) ON DELETE CASCADE,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      status TEXT NOT NULL,
      latency_ms INTEGER,
      http_status INTEGER,
      attempt_count INTEGER NOT NULL DEFAULT 1,
      error TEXT,
      trigger TEXT NOT NULL DEFAULT 'scheduled'
    );

    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      ping_interval_hours INTEGER NOT NULL DEFAULT 72,
      retry_count INTEGER NOT NULL DEFAULT 2,
      retry_delay_seconds INTEGER NOT NULL DEFAULT 2,
      request_timeout_seconds INTEGER NOT NULL DEFAULT 20,
      concurrency INTEGER NOT NULL DEFAULT 3,
      auto_sync INTEGER NOT NULL DEFAULT 1,
      sync_interval_hours INTEGER NOT NULL DEFAULT 24,
      timezone TEXT NOT NULL DEFAULT 'Africa/Cairo'
    );

    CREATE TABLE IF NOT EXISTS job_locks (
      name TEXT PRIMARY KEY,
      locked_until TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_projects_due ON projects(enabled, next_ping_at);
    CREATE INDEX IF NOT EXISTS idx_ping_runs_started ON ping_runs(started_at DESC);
    INSERT OR IGNORE INTO settings (id) VALUES (1);
  `)
}

export function getDb() {
  if (globalThis.__supaactionDb) return globalThis.__supaactionDb
  const file = path.resolve(databasePath())
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const database = new Database(file)
  database.pragma("journal_mode = WAL")
  database.pragma("foreign_keys = ON")
  database.pragma("busy_timeout = 5000")
  migrate(database)
  globalThis.__supaactionDb = database
  return database
}

type ProjectRow = {
  ref: string; account_id: string; account_label: string; name: string; organization_id: string | null
  organization_slug: string | null; region: string | null; remote_status: string; enabled: number
  last_ping_at: string | null; last_ping_status: ProjectRecord["lastPingStatus"]; last_latency_ms: number | null
  last_http_status: number | null; last_error: string | null; next_ping_at: string | null; created_at: string
}

function mapProject(row: ProjectRow): ProjectRecord {
  return {
    ref: row.ref, accountId: row.account_id, accountLabel: row.account_label, name: row.name,
    organizationId: row.organization_id, organizationSlug: row.organization_slug, region: row.region,
    remoteStatus: row.remote_status, enabled: Boolean(row.enabled), lastPingAt: row.last_ping_at,
    lastPingStatus: row.last_ping_status, lastLatencyMs: row.last_latency_ms,
    lastHttpStatus: row.last_http_status, lastError: row.last_error, nextPingAt: row.next_ping_at,
    createdAt: row.created_at,
  }
}

export function listAccounts(): AccountRecord[] {
  const rows = getDb().prepare(`
    SELECT a.id, a.label, a.token_hint, a.status, a.last_synced_at, a.last_error, a.created_at,
           COUNT(p.ref) AS project_count
    FROM accounts a LEFT JOIN projects p ON p.account_id = a.id
    GROUP BY a.id ORDER BY a.created_at DESC
  `).all() as Array<Record<string, string | number | null>>
  return rows.map((row) => ({
    id: String(row.id), label: String(row.label), tokenHint: String(row.token_hint),
    status: row.status as AccountRecord["status"], lastSyncedAt: row.last_synced_at as string | null,
    lastError: row.last_error as string | null, projectCount: Number(row.project_count), createdAt: String(row.created_at),
  }))
}

export function listProjects(): ProjectRecord[] {
  const rows = getDb().prepare(`
    SELECT p.*, a.label AS account_label FROM projects p
    JOIN accounts a ON a.id = p.account_id
    ORDER BY p.enabled DESC, p.name COLLATE NOCASE
  `).all() as ProjectRow[]
  return rows.map(mapProject)
}

export function listRecentRuns(limit = 50): PingRunRecord[] {
  const rows = getDb().prepare(`
    SELECT r.*, p.name AS project_name, a.label AS account_label
    FROM ping_runs r JOIN projects p ON p.ref = r.project_ref
    JOIN accounts a ON a.id = p.account_id
    ORDER BY r.started_at DESC LIMIT ?
  `).all(limit) as Array<Record<string, string | number | null>>
  return rows.map((row) => ({
    id: String(row.id), projectRef: String(row.project_ref), projectName: String(row.project_name),
    accountLabel: String(row.account_label), startedAt: String(row.started_at),
    completedAt: row.completed_at as string | null, status: row.status as PingRunRecord["status"],
    latencyMs: row.latency_ms as number | null, httpStatus: row.http_status as number | null,
    attemptCount: Number(row.attempt_count), error: row.error as string | null,
    trigger: row.trigger as PingRunRecord["trigger"],
  }))
}

export function getSettings(): AppSettings {
  const row = getDb().prepare("SELECT * FROM settings WHERE id = 1").get() as Record<string, string | number>
  return {
    pingIntervalHours: Number(row.ping_interval_hours), retryCount: Number(row.retry_count),
    retryDelaySeconds: Number(row.retry_delay_seconds), requestTimeoutSeconds: Number(row.request_timeout_seconds),
    concurrency: Number(row.concurrency), autoSync: Boolean(row.auto_sync),
    syncIntervalHours: Number(row.sync_interval_hours), timezone: String(row.timezone),
  }
}

export function getDashboardData(): DashboardData {
  const projects = listProjects()
  return {
    totals: {
      accounts: listAccounts().length,
      projects: projects.length,
      protected: projects.filter((project) => project.enabled && project.lastPingStatus !== "failed").length,
      failed: projects.filter((project) => project.lastPingStatus === "failed").length,
    },
    projects,
    recentRuns: listRecentRuns(8),
    settings: getSettings(),
  }
}

export function acquireJobLock(name: string, seconds = 300) {
  const now = new Date()
  const lockedUntil = new Date(now.getTime() + seconds * 1000).toISOString()
  const transaction = getDb().transaction(() => {
    const current = getDb().prepare("SELECT locked_until FROM job_locks WHERE name = ?").get(name) as { locked_until: string } | undefined
    if (current && current.locked_until > now.toISOString()) return false
    getDb().prepare(`INSERT INTO job_locks(name, locked_until) VALUES (?, ?)
      ON CONFLICT(name) DO UPDATE SET locked_until = excluded.locked_until`).run(name, lockedUntil)
    return true
  })
  return transaction()
}

export function releaseJobLock(name: string) {
  getDb().prepare("DELETE FROM job_locks WHERE name = ?").run(name)
}
