export type AccountRecord = {
  id: string
  label: string
  tokenHint: string
  status: "connected" | "error"
  lastSyncedAt: string | null
  lastError: string | null
  projectCount: number
  createdAt: string
}

export type ProjectRecord = {
  ref: string
  accountId: string | null
  accountLabel: string
  name: string
  organizationId: string | null
  organizationSlug: string | null
  region: string | null
  remoteStatus: string
  enabled: boolean
  lastPingAt: string | null
  lastPingStatus: "success" | "failed" | "pending" | null
  lastLatencyMs: number | null
  lastHttpStatus: number | null
  lastError: string | null
  nextPingAt: string | null
  failStreak: number
  lastRestoreAt: string | null
  restoreCount: number
  createdAt: string
}

export type PingRunRecord = {
  id: string
  projectRef: string
  projectName: string
  accountLabel: string
  startedAt: string
  completedAt: string | null
  status: "success" | "failed"
  latencyMs: number | null
  httpStatus: number | null
  attemptCount: number
  error: string | null
  trigger: "scheduled" | "manual"
}

export type AppSettings = {
  pingIntervalHours: number
  retryCount: number
  retryDelaySeconds: number
  requestTimeoutSeconds: number
  concurrency: number
  autoSync: boolean
  syncIntervalHours: number
  timezone: string
}

export type AccountDeletionImpact = {
  projects: number
  runs: number
  rehomed: number
  orphaned: number
}

export type AccountDeletionResult = AccountDeletionImpact & {
  deleted: boolean
}

export type AuditLogRecord = {
  id: string
  action: string
  targetType: string
  targetId: string | null
  summary: string
  createdAt: string
}

export type PaginatedResult<T> = {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export type DashboardData = {
  totals: {
    accounts: number
    projects: number
    protected: number
    failed: number
  }
  projects: ProjectRecord[]
  recentRuns: PingRunRecord[]
  settings: AppSettings
  accountErrors: Array<{ label: string; message: string }>
  schedulerHeartbeat: string | null
  pingSweepHeartbeat: string | null
  lastSuccessfulPingAt: string | null
}
