import assert from "node:assert/strict"
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test, { after } from "node:test"

const testDir = mkdtempSync(join(tmpdir(), "supaaction-test-"))
process.env.DATABASE_PATH = join(testDir, "test.db")
process.env.ENCRYPTION_KEY = "test-encryption-secret-that-is-long-enough"
process.env.SESSION_SECRET = "test-session-secret-that-is-long-enough"
process.env.APP_PASSWORD = "test-password"
process.env.APP_URL = "https://supa.example.test"

const SESSION_COOKIE_NAME = "supaaction_session"
const cookieJar: { name: string; value: string; options: Record<string, unknown> } = {
  name: SESSION_COOKIE_NAME,
  value: "",
  options: {},
}

function setSessionCookie(value: string) {
  cookieJar.name = SESSION_COOKIE_NAME
  cookieJar.value = value
  cookieJar.options = {}
}

function clearSessionCookie() {
  cookieJar.name = SESSION_COOKIE_NAME
  cookieJar.value = ""
  cookieJar.options = {}
}

const require = createRequire(import.meta.url)
const nextHeaders = require("next/headers") as {
  cookies: () => Promise<{
    get: (name: string) => { name: string; value: string } | undefined
    set: (name: string, value: string, options?: Record<string, unknown>) => void
  }>
}
nextHeaders.cookies = async () => ({
  get(name: string) {
    if (name === cookieJar.name && cookieJar.value) return { name, value: cookieJar.value }
    return undefined
  },
  set(name: string, value: string, options?: Record<string, unknown>) {
    cookieJar.name = name
    cookieJar.value = value
    cookieJar.options = options ?? {}
  },
})

after(() => rmSync(testDir, { recursive: true, force: true }))

async function seedProject(ref: string, remoteStatus: string) {
  const { encryptSecret } = await import("../src/lib/crypto")
  const { getDb } = await import("../src/lib/db")
  const database = getDb()
  const now = new Date().toISOString()
  const accountId = `acct-${ref}`
  database.prepare(`INSERT OR REPLACE INTO accounts
    (id, label, encrypted_token, token_hint, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'connected', ?, ?)`)
    .run(accountId, ref, encryptSecret("sbp_seed_token_1234567890"), "sbp_...", now, now)
  database.prepare(`INSERT OR REPLACE INTO projects
    (ref, account_id, name, remote_status, enabled, fail_streak, restore_count, created_at, updated_at)
    VALUES (?, ?, ?, ?, 1, 0, 0, ?, ?)`)
    .run(ref, accountId, ref, remoteStatus, now, now)
}

test("encrypts and decrypts credentials without storing plaintext", async () => {
  const originalFetch = globalThis.fetch
  const plaintext = "sbp_plaintext_storage_token_9f3a7c2b"
  globalThis.fetch = async (input) => {
    if (String(input).endsWith("/projects")) {
      return new Response(JSON.stringify([{ ref: "plaintextstorage001", name: "Plaintext", status: "ACTIVE_HEALTHY" }]), { status: 200 })
    }
    return new Response("not found", { status: 404 })
  }
  try {
    const { addAccount, getAccountToken } = await import("../src/lib/accounts")
    const { getDb } = await import("../src/lib/db")
    const added = await addAccount("Plaintext account", plaintext)
    assert.equal(getAccountToken(added.accountId), plaintext)

    const database = getDb()
    database.pragma("wal_checkpoint(TRUNCATE)")
    const file = process.env.DATABASE_PATH as string
    assert.equal(readFileSync(file).includes(plaintext), false, "plaintext token is present in the SQLite database file")
    for (const suffix of ["-wal", "-shm"]) {
      const sidecar = `${file}${suffix}`
      if (existsSync(sidecar) && readFileSync(sidecar).length > 0) {
        assert.equal(readFileSync(sidecar).includes(plaintext), false, `plaintext token is present in ${suffix}`)
      }
    }
    database.prepare("DELETE FROM project_accounts WHERE project_ref = ?").run("plaintextstorage001")
    database.prepare("DELETE FROM projects WHERE ref = ?").run("plaintextstorage001")
    database.prepare("DELETE FROM accounts WHERE id = ?").run(added.accountId)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("creates database defaults", async () => {
  const { getSettings, listAccounts, listProjects } = await import("../src/lib/db")
  assert.equal(getSettings().pingIntervalHours, 72)
  assert.deepEqual(listAccounts(), [])
  assert.deepEqual(listProjects(), [])
})

test("rate limits repeated failed logins", async () => {
  const { clearFailedLogins, loginRateLimit, recordFailedLogin } = await import("../src/lib/auth")
  const key = "unit-test-client"
  clearFailedLogins(key)
  assert.equal(loginRateLimit(key).allowed, true)
  for (let attempt = 0; attempt < 10; attempt += 1) recordFailedLogin(key)
  assert.equal(loginRateLimit(key).allowed, false)
  const { getDb } = await import("../src/lib/db")
  assert.equal((getDb().prepare("SELECT attempt_count FROM auth_attempts WHERE key = ?").get(key) as { attempt_count: number }).attempt_count, 10)
  clearFailedLogins(key)
})

test("rejects missing and cross-origin mutation requests", async () => {
  const fs = await import("node:fs")
  const path = await import("node:path")
  const { createSessionToken } = await import("../src/lib/auth")
  setSessionCookie(createSessionToken())

  const apiDir = path.join(process.cwd(), "src", "app", "api")
  const routeFiles = (fs.readdirSync(apiDir, { recursive: true }) as string[]).filter((file) => file.endsWith("route.ts"))
  const methods = ["POST", "PUT", "PATCH", "DELETE"]
  const mutating: Array<{ method: string; handler: (request: Request, context: unknown) => Promise<Response> }> = []

  for (const file of routeFiles) {
    const routeModule = await import(`../src/app/api/${file}`) as Record<string, unknown>
    for (const method of methods) {
      if (typeof routeModule[method] === "function") {
        mutating.push({ method, handler: routeModule[method] as (request: Request, context: unknown) => Promise<Response> })
      }
    }
  }

  assert.ok(mutating.length >= 9, `expected at least 9 mutating handlers, found ${mutating.length}`)
  for (const { method, handler } of mutating) {
    const response = await handler(new Request("https://supa.example.test/api/accounts", {
      method,
      headers: { origin: "https://evil.example" },
    }), { params: Promise.resolve({ id: "dummy-id", ref: "dummy-ref" }) })
    assert.equal(response.status, 403, `${method} handler did not reject a cross-origin request`)
  }
})

test("records administrative audit events without secrets", async () => {
  const originalFetch = globalThis.fetch
  const token = "sbp_no_leak_marker_9f3a7c2b"
  const fragment = token.slice(4, -4)
  globalThis.fetch = async (input) => {
    if (String(input).endsWith("/projects")) {
      return new Response(JSON.stringify([{ ref: "auditleakproject01", name: "Audit", status: "ACTIVE_HEALTHY" }]), { status: 200 })
    }
    return new Response("not found", { status: 404 })
  }
  try {
    const { createSessionToken } = await import("../src/lib/auth")
    setSessionCookie(createSessionToken())
    const { POST } = await import("../src/app/api/accounts/route")
    const response = await POST(new Request("https://supa.example.test/api/accounts", {
      method: "POST",
      headers: { origin: "https://supa.example.test", "content-type": "application/json" },
      body: JSON.stringify({ label: "Audit account", token }),
    }))
    assert.equal(response.status, 201)
    const payload = await response.json() as { accountId: string }

    const { getDb } = await import("../src/lib/db")
    const database = getDb()
    const secrets = [token, fragment]

    const auditRows = database.prepare("SELECT * FROM audit_logs").all() as Array<Record<string, unknown>>
    for (const row of auditRows) {
      const text = Object.values(row).map((value) => String(value ?? "")).join("\n")
      for (const secret of secrets) {
        assert.equal(text.includes(secret), false, `audit_logs leaked ${secret}`)
      }
    }

    const accountColumns = (database.pragma("table_info(accounts)") as Array<{ name: string }>)
      .map((column) => column.name).filter((name) => name !== "encrypted_token")
    const account = database.prepare("SELECT * FROM accounts WHERE id = ?").get(payload.accountId) as Record<string, unknown>
    for (const column of accountColumns) {
      const value = String(account[column] ?? "")
      for (const secret of secrets) {
        assert.equal(value.includes(secret), false, `accounts.${column} leaked ${secret}`)
      }
    }
    database.prepare("DELETE FROM project_accounts WHERE project_ref = ?").run("auditleakproject01")
    database.prepare("DELETE FROM projects WHERE ref = ?").run("auditleakproject01")
    database.prepare("DELETE FROM accounts WHERE id = ?").run(payload.accountId)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("tracks scheduler heartbeat health", async () => {
  const { getDb, updateServiceHeartbeat } = await import("../src/lib/db")
  const { GET } = await import("../src/app/api/health/route")
  const database = getDb()
  database.prepare("DELETE FROM service_status WHERE name IN ('scheduler', 'ping-sweep')").run()

  updateServiceHeartbeat("scheduler")
  updateServiceHeartbeat("ping-sweep")
  let body = await (await GET()).json() as { scheduler: string; sweep: string }
  assert.equal(body.scheduler, "ok")
  assert.equal(body.sweep, "ok")

  database.prepare("UPDATE service_status SET last_heartbeat_at = ? WHERE name = 'ping-sweep'")
    .run(new Date(Date.now() - 11 * 60 * 1000).toISOString())
  body = await (await GET()).json() as { scheduler: string; sweep: string }
  assert.equal(body.scheduler, "ok")
  assert.equal(body.sweep, "stale")

  database.prepare("DELETE FROM service_status WHERE name = 'ping-sweep'").run()
  body = await (await GET()).json() as { scheduler: string; sweep: string }
  assert.equal(body.scheduler, "ok")
  assert.equal(body.sweep, "unknown")
})

test("stores a changed admin password securely and revokes old sessions", async () => {
  const { createSessionToken, setAdminPassword, verifyPassword, verifySessionToken } = await import("../src/lib/auth")
  const oldSession = createSessionToken()
  assert.equal(verifyPassword("test-password"), true)
  assert.equal(verifySessionToken(oldSession), true)

  setAdminPassword("new-secure-password")

  assert.equal(verifyPassword("test-password"), false)
  assert.equal(verifyPassword("new-secure-password"), true)
  assert.equal(verifySessionToken(oldSession), false)
  assert.equal(verifySessionToken(createSessionToken()), true)

  const { getDb } = await import("../src/lib/db")
  const stored = getDb().prepare("SELECT password_hash FROM admin_auth WHERE id = 1").get() as { password_hash: string }
  assert.equal(stored.password_hash.includes("new-secure-password"), false)
})

test("discovers projects and executes a read-only database ping", async () => {
  const originalFetch = globalThis.fetch
  const calls: Array<{ url: string; method: string }> = []
  globalThis.fetch = async (input, init) => {
    const url = String(input)
    calls.push({ url, method: init?.method || "GET" })
    if (url.endsWith("/projects")) {
      return new Response(JSON.stringify([{ ref: "abcdefghijklmnopqrst", name: "Demo", status: "ACTIVE_HEALTHY" }]), { status: 200 })
    }
    if (url.includes("/database/query/read-only")) return new Response(JSON.stringify([{ supaaction_ping: 1 }]), { status: 201 })
    return new Response("not found", { status: 404 })
  }

  try {
    const { addAccount } = await import("../src/lib/accounts")
    const { listProjectRuns, listProjects, listProjectsPage, listRecentRuns, listRecentRunsPage } = await import("../src/lib/db")
    const { pingProjects } = await import("../src/lib/pinger")
    const added = await addAccount("Demo account", "sbp_example_token_1234567890")
    assert.equal(added.projectCount, 1)
    assert.equal(listProjects()[0].name, "Demo")
    assert.equal(listProjectsPage(1, 25, "Demo").total, 1)
    assert.equal(listProjectsPage(1, 25, "missing").total, 0)
    const results = await pingProjects(undefined, "manual")
    assert.equal(results[0].status, "success")
    assert.equal(listRecentRuns(1)[0].httpStatus, 201)
    assert.equal(listProjectRuns("abcdefghijklmnopqrst")[0].httpStatus, 201)
    assert.deepEqual(listProjectRuns("missing-project"), [])
    assert.equal(listRecentRunsPage(1, 1).total, 1)
    assert.equal(calls.some((call) => call.url.endsWith("/projects") && call.method === "GET"), true)
    assert.equal(calls.some((call) => call.url.includes("/database/query/read-only") && call.method === "POST"), true)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("reports every dashboard health problem without alarming on intentionally disabled projects", async () => {
  const { getHealthState } = await import("../src/components/health-banner")
  const project = {
    ref: "health-project", accountId: "account", accountLabel: "Account", name: "Health",
    organizationId: null, organizationSlug: null, region: null, remoteStatus: "ACTIVE_HEALTHY",
    enabled: true, lastPingAt: null, lastPingStatus: "success" as const, lastLatencyMs: null,
    lastHttpStatus: null, lastError: null, nextPingAt: null, failStreak: 0, lastRestoreAt: null,
    restoreCount: 0, createdAt: new Date().toISOString(),
  }
  const now = Date.now()
  const fresh = new Date(now).toISOString()
  const healthyInputs = {
    projects: [project], accountErrors: [], schedulerHeartbeat: fresh,
    pingSweepHeartbeat: fresh, lastSuccessfulPingAt: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
  }

  const healthy = getHealthState(healthyInputs, now)
  assert.equal(healthy.state, "healthy")
  assert.deepEqual(healthy.problems, [])
  assert.match(healthy.lastSuccess, /منذ ٣ ساعات/)

  const accountError = getHealthState({
    ...healthyInputs,
    accountErrors: [{ label: "حساب الإنتاج", message: "انتهت صلاحية الرمز" }],
  }, now)
  assert.equal(accountError.state, "danger")
  assert.match(accountError.problems.join(" "), /حساب الإنتاج/)

  const staleSweep = getHealthState({
    ...healthyInputs,
    pingSweepHeartbeat: new Date(now - 11 * 60 * 1000).toISOString(),
  }, now)
  assert.equal(staleSweep.state, "danger")
  assert.match(staleSweep.problems.join(" "), /توقفت دورة تنشيط المشاريع/)

  const pausedAndStale = getHealthState({
    ...healthyInputs,
    projects: [{ ...project, remoteStatus: "PAUSED" }],
    schedulerHeartbeat: new Date(now - 11 * 60 * 1000).toISOString(),
  }, now)
  assert.equal(pausedAndStale.state, "danger")
  assert.equal(pausedAndStale.problems.some((problem) => problem.includes("مشاريع متوقفة")), true)
  assert.equal(pausedAndStale.problems.some((problem) => problem.includes("نبضة المجدول")), true)

  const disabled = getHealthState({
    ...healthyInputs,
    projects: [{ ...project, enabled: false, remoteStatus: "PAUSED", failStreak: 4 }],
  }, now)
  assert.equal(disabled.state, "healthy")

  const orphaned = getHealthState({
    ...healthyInputs,
    projects: [{ ...project, accountId: null, enabled: false }],
  }, now)
  assert.equal(orphaned.state, "danger")
  assert.match(orphaned.problems.join(" "), /Health/)

  assert.equal(getHealthState({ ...healthyInputs, pingSweepHeartbeat: null }, now).state, "healthy")
  assert.match(getHealthState({ ...healthyInputs, lastSuccessfulPingAt: null }, now).lastSuccess, /لم يُسجّل/)
})

test("does not retry a paused-project response", async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => new Response(JSON.stringify({ message: "Project is paused" }), { status: 540 })
  try {
    const { queryProject, SupabaseApiError } = await import("../src/lib/supabase-management")
    await assert.rejects(() => queryProject("token", "project-ref", 5), (error) => {
      assert.equal(error instanceof SupabaseApiError, true)
      assert.equal((error as InstanceType<typeof SupabaseApiError>).retryable, false)
      return true
    })
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("backs off failing pings within the ping interval", async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => new Response(JSON.stringify({ message: "bad request" }), { status: 400 })
  const ref = "backoffwindowproject01"
  try {
    await seedProject(ref, "ACTIVE_HEALTHY")
    const { pingProjects } = await import("../src/lib/pinger")
    const { getDb } = await import("../src/lib/db")
    const database = getDb()
    const backoffMinutes = [15, 60, 360]
    for (let index = 0; index < backoffMinutes.length; index += 1) {
      const before = Date.now()
      await pingProjects([ref], "manual")
      const row = database.prepare("SELECT next_ping_at, fail_streak FROM projects WHERE ref = ?")
        .get(ref) as { next_ping_at: string; fail_streak: number }
      assert.equal(row.fail_streak, index + 1)
      const expected = backoffMinutes[index] * 60 * 1000
      const elapsed = Date.parse(row.next_ping_at) - before
      assert.ok(elapsed >= expected - 2000 && elapsed <= expected + 2000, `streak ${index + 1}: expected ~${expected}ms, got ${elapsed}ms`)
    }
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("shortens the next ping when a ping fails and increments the fail streak", async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => new Response(JSON.stringify({ message: "bad request" }), { status: 400 })
  const ref = "failstreakproject001"
  try {
    await seedProject(ref, "ACTIVE_HEALTHY")
    const { pingProjects } = await import("../src/lib/pinger")
    const { getDb } = await import("../src/lib/db")
    await pingProjects([ref], "manual")
    const row = getDb().prepare("SELECT fail_streak, next_ping_at, last_ping_status FROM projects WHERE ref = ?")
      .get(ref) as { fail_streak: number; next_ping_at: string; last_ping_status: string }
    assert.equal(row.fail_streak, 1)
    assert.equal(row.last_ping_status, "failed")
    const untilNext = Date.parse(row.next_ping_at) - Date.now()
    assert.ok(untilNext > 0 && untilNext < 60 * 60 * 1000, `expected under one hour, got ${untilNext}ms`)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("restores a paused project once per cooldown window", async () => {
  const originalFetch = globalThis.fetch
  const calls: Array<{ url: string; method: string }> = []
  globalThis.fetch = async (input, init) => {
    const url = String(input)
    const method = init?.method || "GET"
    calls.push({ url, method })
    if (url.endsWith("/restore")) return new Response(JSON.stringify({}), { status: 200 })
    if (url.includes("/database/query/read-only")) return new Response(JSON.stringify({ message: "Project is paused" }), { status: 540 })
    if (method === "GET") return new Response(JSON.stringify({ ref, name: ref, status: "PAUSED" }), { status: 200 })
    return new Response("not found", { status: 404 })
  }
  const ref = "pausedcooldownprj001"
  try {
    await seedProject(ref, "PAUSED")
    const { pingProjects } = await import("../src/lib/pinger")
    const { getDb } = await import("../src/lib/db")
    const database = getDb()
    const restores = () => calls.filter((call) => call.url.endsWith("/restore") && call.method === "POST").length

    await pingProjects([ref], "manual")
    assert.equal(restores(), 1)

    await pingProjects([ref], "manual")
    assert.equal(restores(), 1)

    const row = () => database.prepare("SELECT restore_count, last_restore_at FROM projects WHERE ref = ?")
      .get(ref) as { restore_count: number; last_restore_at: string | null }
    assert.equal(row().restore_count, 1)
    assert.equal(typeof row().last_restore_at, "string")

    database.prepare("UPDATE projects SET last_restore_at = ? WHERE ref = ?")
      .run(new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString(), ref)
    await pingProjects([ref], "manual")
    assert.equal(restores(), 2)
    assert.equal(row().restore_count, 2)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("contains an undecryptable token to its own project and still pings the rest", async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input) => {
    const url = String(input)
    if (url.includes("/database/query/read-only")) return new Response(JSON.stringify([{ supaaction_ping: 1 }]), { status: 201 })
    return new Response("not found", { status: 404 })
  }
  const badRef = "badtokenproject001"
  const goodRef = "goodtokenproject001"
  try {
    await seedProject(badRef, "ACTIVE_HEALTHY")
    await seedProject(goodRef, "ACTIVE_HEALTHY")
    const { getDb } = await import("../src/lib/db")
    getDb().prepare("UPDATE accounts SET encrypted_token = ? WHERE id = ?").run("corrupted-token", `acct-${badRef}`)

    const { pingProjects } = await import("../src/lib/pinger")
    const results = await pingProjects([badRef, goodRef], "manual")
    assert.equal(results.length, 2)

    const database = getDb()
    const badRun = database.prepare("SELECT COUNT(*) AS count FROM ping_runs WHERE project_ref = ?").get(badRef) as { count: number }
    const goodRun = database.prepare("SELECT COUNT(*) AS count FROM ping_runs WHERE project_ref = ?").get(goodRef) as { count: number }
    assert.equal(badRun.count, 1)
    assert.equal(goodRun.count, 1)

    const badProject = database.prepare("SELECT next_ping_at, last_ping_status, last_error FROM projects WHERE ref = ?")
      .get(badRef) as { next_ping_at: string; last_ping_status: string; last_error: string }
    const goodProject = database.prepare("SELECT last_ping_status FROM projects WHERE ref = ?")
      .get(goodRef) as { last_ping_status: string }
    assert.equal(badProject.last_ping_status, "failed")
    assert.ok(Date.parse(badProject.next_ping_at) > Date.now())
    assert.equal(badProject.last_error, "Account token is unavailable or could not be decrypted")
    assert.equal(badProject.last_error.includes("corrupted-token"), false)
    assert.equal(goodProject.last_ping_status, "success")
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("refreshes the ping-sweep marker when the sweep completes", async () => {
  const { getDb } = await import("../src/lib/db")
  getDb().prepare("DELETE FROM service_status WHERE name = ?").run("ping-sweep")
  getDb().prepare("UPDATE projects SET next_ping_at = ?").run(new Date(Date.now() + 3_600_000).toISOString())
  const { runPingSweep } = await import("../src/lib/scheduler")
  await runPingSweep()
  const { getServiceHeartbeat } = await import("../src/lib/db")
  assert.equal(typeof getServiceHeartbeat("ping-sweep"), "string")
})

test("does not refresh the ping-sweep marker when the sweep throws", async () => {
  const { getDb } = await import("../src/lib/db")
  getDb().prepare("DELETE FROM service_status WHERE name = ?").run("ping-sweep")
  const { runPingSweep } = await import("../src/lib/scheduler")
  await assert.rejects(() => runPingSweep(() => Promise.reject(new Error("sweep failed"))), /sweep failed/)
  const { getServiceHeartbeat } = await import("../src/lib/db")
  assert.equal(getServiceHeartbeat("ping-sweep"), null)
})

test("a retryable restore failure leaves the restore cooldown untouched", async () => {
  const originalFetch = globalThis.fetch
  const ref = "retryablerestore01"
  const calls: Array<{ url: string; method: string }> = []
  globalThis.fetch = async (input, init) => {
    const url = String(input)
    const method = init?.method || "GET"
    calls.push({ url, method })
    if (url.endsWith("/restore")) return new Response(JSON.stringify({ message: "Server error" }), { status: 500 })
    if (method === "GET") return new Response(JSON.stringify({ ref, name: ref, status: "PAUSED" }), { status: 200 })
    return new Response("not found", { status: 404 })
  }
  try {
    await seedProject(ref, "PAUSED")
    const { pingProjects } = await import("../src/lib/pinger")
    const { getDb } = await import("../src/lib/db")
    const restores = () => calls.filter((call) => call.url.endsWith("/restore") && call.method === "POST").length

    await pingProjects([ref], "manual")
    const row = getDb().prepare("SELECT last_restore_at, restore_count, last_error FROM projects WHERE ref = ?")
      .get(ref) as { last_restore_at: string | null; restore_count: number; last_error: string }
    assert.equal(row.last_restore_at, null)
    assert.equal(row.restore_count, 0)
    assert.match(row.last_error, /Server error/)
    assert.equal(restores(), 1)

    await pingProjects([ref], "manual")
    assert.equal(restores(), 2)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("a forbidden restore failure starts the cooldown and records an Arabic reason", async () => {
  const originalFetch = globalThis.fetch
  const ref = "forbiddenrestore01"
  globalThis.fetch = async (input, init) => {
    const url = String(input)
    const method = init?.method || "GET"
    if (url.endsWith("/restore")) return new Response(JSON.stringify({ message: "Forbidden" }), { status: 403 })
    if (method === "GET") return new Response(JSON.stringify({ ref, name: ref, status: "PAUSED" }), { status: 200 })
    return new Response("not found", { status: 404 })
  }
  try {
    await seedProject(ref, "PAUSED")
    const { pingProjects, RESTORE_FORBIDDEN_REASON } = await import("../src/lib/pinger")
    const { getDb } = await import("../src/lib/db")
    await pingProjects([ref], "manual")
    const row = getDb().prepare("SELECT last_restore_at, restore_count, last_error FROM projects WHERE ref = ?")
      .get(ref) as { last_restore_at: string | null; restore_count: number; last_error: string }
    assert.equal(typeof row.last_restore_at, "string")
    assert.equal(row.restore_count, 1)
    assert.equal(row.last_error, RESTORE_FORBIDDEN_REASON)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("parses the Retry-After header from seconds, HTTP dates and garbage", async () => {
  const { parseRetryAfter } = await import("../src/lib/supabase-management")
  assert.equal(parseRetryAfter("30"), 30)
  const parsed = parseRetryAfter(new Date(Date.now() + 60_000).toUTCString())
  assert.ok(typeof parsed === "number" && parsed >= 58 && parsed <= 61, `expected about 60, got ${parsed}`)
  assert.equal(parseRetryAfter("not-a-date"), undefined)
  assert.equal(parseRetryAfter(""), undefined)
  assert.equal(parseRetryAfter(null), undefined)
})

test("rate limits failed logins per client IP", async () => {
  const { clearFailedLogins, loginRateLimit, recordFailedLogin } = await import("../src/lib/auth")
  clearFailedLogins("global")
  clearFailedLogins("ip:1.2.3.4")
  clearFailedLogins("ip:5.6.7.8")
  for (let attempt = 0; attempt < 10; attempt += 1) recordFailedLogin("ip:1.2.3.4")
  assert.equal(loginRateLimit("ip:1.2.3.4").allowed, false)
  assert.equal(loginRateLimit("ip:5.6.7.8").allowed, true)
  clearFailedLogins("ip:1.2.3.4")
  clearFailedLogins("ip:5.6.7.8")
  clearFailedLogins("global")
})

test("blocks logins after the per-client budget is exhausted", async () => {
  const { chargeLoginAttempt, clearFailedLogins } = await import("../src/lib/auth")
  const key = "charge-test-client"
  clearFailedLogins(key)
  for (let attempt = 0; attempt < 10; attempt += 1) {
    assert.equal(chargeLoginAttempt(key).allowed, true)
  }
  assert.equal(chargeLoginAttempt(key).allowed, false)
  clearFailedLogins(key)
})

test("rejects verifications beyond the in-flight cap without hashing", async () => {
  const { acquireVerificationSlot, clearFailedLogins, releaseVerificationSlot } = await import("../src/lib/auth")
  const { getDb } = await import("../src/lib/db")
  const { POST } = await import("../src/app/api/auth/login/route")
  clearFailedLogins("direct")
  assert.equal(acquireVerificationSlot(), true)
  assert.equal(acquireVerificationSlot(), true)
  try {
    const response = await POST(new Request("https://supa.example.test/api/auth/login", {
      method: "POST",
      headers: { origin: "https://supa.example.test", "content-type": "application/json" },
      body: JSON.stringify({ password: "anything" }),
    }))
    assert.equal(response.status, 429)
    assert.equal(typeof response.headers.get("Retry-After"), "string")
    const charged = (getDb().prepare("SELECT attempt_count FROM auth_attempts WHERE key = ?").get("direct") as { attempt_count: number } | undefined)?.attempt_count ?? 0
    assert.equal(charged, 0)
  } finally {
    releaseVerificationSlot()
    releaseVerificationSlot()
  }
})

test("login charges the rate-limit budget and keeps verifying a direct key", async () => {
  const env = process.env as Record<string, string | undefined>
  const previousTrustedProxy = env.TRUSTED_PROXY
  const { clearFailedLogins } = await import("../src/lib/auth")
  const { getDb } = await import("../src/lib/db")
  const { POST } = await import("../src/app/api/auth/login/route")
  try {
    delete env.TRUSTED_PROXY
    clearFailedLogins("direct")
    const attempt = () => POST(new Request("https://supa.example.test/api/auth/login", {
      method: "POST",
      headers: { origin: "https://supa.example.test", "content-type": "application/json" },
      body: JSON.stringify({ password: "wrong-password" }),
    }))
    const first = await attempt()
    assert.equal(first.status, 401)
    const charged = (getDb().prepare("SELECT attempt_count FROM auth_attempts WHERE key = ?").get("direct") as { attempt_count: number } | undefined)?.attempt_count ?? 0
    assert.equal(charged, 1)

    for (let index = 1; index < 10; index += 1) assert.equal((await attempt()).status, 401)
    const eleventh = await attempt()
    assert.equal(eleventh.status, 401)
  } finally {
    clearFailedLogins("direct")
    if (previousTrustedProxy === undefined) delete env.TRUSTED_PROXY
    else env.TRUSTED_PROXY = previousTrustedProxy
  }
})

test("behind a trusted proxy, a spent IP is denied while a fresh IP is verified", async () => {
  const env = process.env as Record<string, string | undefined>
  const previousTrustedProxy = env.TRUSTED_PROXY
  const { clearFailedLogins } = await import("../src/lib/auth")
  const { POST } = await import("../src/app/api/auth/login/route")
  try {
    env.TRUSTED_PROXY = "true"
    clearFailedLogins("ip:1.2.3.4")
    clearFailedLogins("ip:5.6.7.8")
    const attempt = (ip: string) => POST(new Request("https://supa.example.test/api/auth/login", {
      method: "POST",
      headers: { origin: "https://supa.example.test", "content-type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify({ password: "wrong-password" }),
    }))
    for (let index = 0; index < 10; index += 1) assert.equal((await attempt("1.2.3.4")).status, 401)
    const spent = await attempt("1.2.3.4")
    assert.equal(spent.status, 429)
    assert.equal(typeof spent.headers.get("Retry-After"), "string")
    const fresh = await attempt("5.6.7.8")
    assert.equal(fresh.status, 401)
  } finally {
    clearFailedLogins("ip:1.2.3.4")
    clearFailedLogins("ip:5.6.7.8")
    if (previousTrustedProxy === undefined) delete env.TRUSTED_PROXY
    else env.TRUSTED_PROXY = previousTrustedProxy
  }
})

test("login sets an HttpOnly session cookie on a correct password", async () => {
  const env = process.env as Record<string, string | undefined>
  const previousTrustedProxy = env.TRUSTED_PROXY
  const { clearFailedLogins, setAdminPassword } = await import("../src/lib/auth")
  const { POST } = await import("../src/app/api/auth/login/route")
  const password = "correct-password-for-login"
  try {
    delete env.TRUSTED_PROXY
    clearFailedLogins("direct")
    setAdminPassword(password)
    clearSessionCookie()
    const response = await POST(new Request("https://supa.example.test/api/auth/login", {
      method: "POST",
      headers: { origin: "https://supa.example.test", "content-type": "application/json" },
      body: JSON.stringify({ password }),
    }))
    assert.equal(response.status, 200)
    assert.equal(cookieJar.name, SESSION_COOKIE_NAME)
    assert.ok(cookieJar.value.length > 0)
    assert.equal(cookieJar.options.httpOnly, true)
  } finally {
    clearSessionCookie()
    clearFailedLogins("direct")
    if (previousTrustedProxy === undefined) delete env.TRUSTED_PROXY
    else env.TRUSTED_PROXY = previousTrustedProxy
  }
})

test("maps forwarded headers to a rate-limit key only behind a trusted proxy", async () => {
  const env = process.env as Record<string, string | undefined>
  const previousTrustedProxy = env.TRUSTED_PROXY
  const { loginRateLimitKey } = await import("../src/lib/auth")
  try {
    delete env.TRUSTED_PROXY
    const directA = loginRateLimitKey(new Request("https://supa.example.test/api/auth/login", {
      headers: { "x-forwarded-for": "1.2.3.4" },
    }))
    const directB = loginRateLimitKey(new Request("https://supa.example.test/api/auth/login", {
      headers: { "x-forwarded-for": "5.6.7.8" },
    }))
    assert.equal(directA, directB)
    assert.equal(directA, "direct")

    env.TRUSTED_PROXY = "true"
    const proxiedA = loginRateLimitKey(new Request("https://supa.example.test/api/auth/login", {
      headers: { "x-forwarded-for": "1.2.3.4" },
    }))
    const proxiedB = loginRateLimitKey(new Request("https://supa.example.test/api/auth/login", {
      headers: { "x-forwarded-for": "5.6.7.8" },
    }))
    assert.notEqual(proxiedA, proxiedB)
  } finally {
    if (previousTrustedProxy === undefined) delete env.TRUSTED_PROXY
    else env.TRUSTED_PROXY = previousTrustedProxy
  }
})

test("keeps verifying the unidentifiable direct key instead of hard-denying", async () => {
  const env = process.env as Record<string, string | undefined>
  const previousTrustedProxy = env.TRUSTED_PROXY
  const { clearFailedLogins, isDirectRateLimitKey, loginSlowdownMs } = await import("../src/lib/auth")
  const { POST } = await import("../src/app/api/auth/login/route")
  try {
    delete env.TRUSTED_PROXY
    clearFailedLogins("direct")
    assert.equal(isDirectRateLimitKey("direct"), true)
    assert.equal(loginSlowdownMs(), 1000)
    const attempt = () => POST(new Request("https://supa.example.test/api/auth/login", {
      method: "POST",
      headers: { origin: "https://supa.example.test", "content-type": "application/json" },
      body: JSON.stringify({ password: "wrong-password" }),
    }))
    for (let index = 0; index < 10; index += 1) {
      assert.equal((await attempt()).status, 401)
    }
    const eleventh = await attempt()
    assert.equal(eleventh.status, 401)
  } finally {
    clearFailedLogins("direct")
    if (previousTrustedProxy === undefined) delete env.TRUSTED_PROXY
    else env.TRUSTED_PROXY = previousTrustedProxy
  }
})

test("hard-denies an identifiable client IP at the per-key budget", async () => {
  const env = process.env as Record<string, string | undefined>
  const previousTrustedProxy = env.TRUSTED_PROXY
  const { clearFailedLogins } = await import("../src/lib/auth")
  const { POST } = await import("../src/app/api/auth/login/route")
  try {
    env.TRUSTED_PROXY = "true"
    clearFailedLogins("ip:9.9.9.9")
    const attempt = () => POST(new Request("https://supa.example.test/api/auth/login", {
      method: "POST",
      headers: { origin: "https://supa.example.test", "content-type": "application/json", "x-forwarded-for": "9.9.9.9" },
      body: JSON.stringify({ password: "wrong-password" }),
    }))
    for (let index = 0; index < 10; index += 1) {
      assert.equal((await attempt()).status, 401)
    }
    const eleventh = await attempt()
    assert.equal(eleventh.status, 429)
    assert.equal(typeof eleventh.headers.get("Retry-After"), "string")
  } finally {
    clearFailedLogins("ip:9.9.9.9")
    if (previousTrustedProxy === undefined) delete env.TRUSTED_PROXY
    else env.TRUSTED_PROXY = previousTrustedProxy
  }
})

test("returns 503 for a misconfigured production admin password", async () => {
  const env = process.env as Record<string, string | undefined>
  const previousNodeEnv = env.NODE_ENV
  const previousAppPassword = env.APP_PASSWORD
  const { clearFailedLogins } = await import("../src/lib/auth")
  const { getDb } = await import("../src/lib/db")
  const { POST } = await import("../src/app/api/auth/login/route")
  const database = getDb()
  const previousAuth = database.prepare("SELECT password_salt, password_hash, session_version FROM admin_auth WHERE id = 1")
    .get() as { password_salt: string; password_hash: string; session_version: number } | undefined
  try {
    database.prepare("DELETE FROM admin_auth").run()
    clearFailedLogins("direct")
    env.NODE_ENV = "production"
    env.APP_PASSWORD = "short"
    const response = await POST(new Request("https://supa.example.test/api/auth/login", {
      method: "POST",
      headers: { origin: "https://supa.example.test", "content-type": "application/json" },
      body: JSON.stringify({ password: "anything" }),
    }))
    assert.equal(response.status, 503)
    const body = await response.json() as { error: string }
    assert.equal(body.error.includes("APP_PASSWORD"), true)
  } finally {
    if (previousAuth) {
      database.prepare("UPDATE admin_auth SET password_salt = ?, password_hash = ?, session_version = ? WHERE id = 1")
        .run(previousAuth.password_salt, previousAuth.password_hash, previousAuth.session_version)
    }
    clearFailedLogins("direct")
    if (previousNodeEnv === undefined) delete env.NODE_ENV
    else env.NODE_ENV = previousNodeEnv
    if (previousAppPassword === undefined) delete env.APP_PASSWORD
    else env.APP_PASSWORD = previousAppPassword
  }
})

test("rejects short secrets in production", async () => {
  const env = process.env as Record<string, string | undefined>
  const previousNodeEnv = env.NODE_ENV
  const previousEncryptionKey = env.ENCRYPTION_KEY
  const previousSessionSecret = env.SESSION_SECRET
  const { encryptionKey, sessionSecret } = await import("../src/lib/env")
  try {
    env.NODE_ENV = "production"
    env.ENCRYPTION_KEY = "short"
    assert.throws(() => encryptionKey(), /at least 32 characters/)
    env.ENCRYPTION_KEY = previousEncryptionKey
    env.SESSION_SECRET = "short"
    assert.throws(() => sessionSecret(), /at least 32 characters/)
  } finally {
    if (previousNodeEnv === undefined) delete env.NODE_ENV
    else env.NODE_ENV = previousNodeEnv
    if (previousEncryptionKey === undefined) delete env.ENCRYPTION_KEY
    else env.ENCRYPTION_KEY = previousEncryptionKey
    if (previousSessionSecret === undefined) delete env.SESSION_SECRET
    else env.SESSION_SECRET = previousSessionSecret
  }
})

test("rejects the sample admin password in production", async () => {
  const env = process.env as Record<string, string | undefined>
  const previousNodeEnv = env.NODE_ENV
  const previousAppPassword = env.APP_PASSWORD
  const { appPassword } = await import("../src/lib/env")
  try {
    env.NODE_ENV = "production"
    env.APP_PASSWORD = "change-this-admin-password"
    assert.throws(() => appPassword(), /change-this-admin-password/)
    env.APP_PASSWORD = "a-strong-password-long-enough"
    assert.equal(appPassword(), "a-strong-password-long-enough")
  } finally {
    if (previousNodeEnv === undefined) delete env.NODE_ENV
    else env.NODE_ENV = previousNodeEnv
    if (previousAppPassword === undefined) delete env.APP_PASSWORD
    else env.APP_PASSWORD = previousAppPassword
  }
})

test("re-checks a stored paused status before restoring", async () => {
  const originalFetch = globalThis.fetch
  const ref = "revivedproject0000001"
  const calls: Array<{ url: string; method: string }> = []
  globalThis.fetch = async (input, init) => {
    const url = String(input)
    const method = init?.method || "GET"
    calls.push({ url, method })
    if (url.endsWith("/restore")) return new Response(JSON.stringify({}), { status: 200 })
    if (url.includes("/database/query/read-only")) return new Response(JSON.stringify([{ supaaction_ping: 1 }]), { status: 201 })
    if (method === "GET") return new Response(JSON.stringify({ ref, name: ref, status: "ACTIVE_HEALTHY" }), { status: 200 })
    return new Response("not found", { status: 404 })
  }
  try {
    await seedProject(ref, "INACTIVE")
    const { pingProjects } = await import("../src/lib/pinger")
    const { getDb } = await import("../src/lib/db")

    const results = await pingProjects([ref], "manual")
    assert.equal(results[0].status, "success")
    assert.equal(calls.filter((call) => call.url.includes("/database/query/read-only")).length, 1)
    assert.equal(calls.filter((call) => call.url.endsWith("/restore") && call.method === "POST").length, 0)

    const row = getDb().prepare("SELECT fail_streak, last_ping_status, remote_status FROM projects WHERE ref = ?")
      .get(ref) as { fail_streak: number; last_ping_status: string; remote_status: string }
    assert.equal(row.fail_streak, 0)
    assert.equal(row.last_ping_status, "success")
    assert.equal(row.remote_status, "ACTIVE_HEALTHY")
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("deleting one account preserves a project seen by another account and its history", async () => {
  const originalFetch = globalThis.fetch
  const ref = "sharedprojectref0001"
  globalThis.fetch = async (input) => {
    if (String(input).endsWith("/projects")) {
      return new Response(JSON.stringify([{ ref, name: "Shared", status: "ACTIVE_HEALTHY" }]), { status: 200 })
    }
    return new Response("not found", { status: 404 })
  }
  try {
    const { addAccount, deleteAccount } = await import("../src/lib/accounts")
    const { getDb, listProjects } = await import("../src/lib/db")
    const first = await addAccount("First", "sbp_token_first_123456789")
    const second = await addAccount("Second", "sbp_token_second_12345678")
    const database = getDb()
    database.prepare(`INSERT INTO ping_runs (id, project_ref, started_at, completed_at, status, latency_ms, http_status, attempt_count, trigger)
      VALUES (?, ?, ?, ?, 'success', 12, 200, 1, 'manual')`)
      .run("run-shared", ref, new Date().toISOString(), new Date().toISOString())

    const result = deleteAccount(second.accountId)
    assert.equal(result.deleted, true)
    assert.equal(result.rehomed, 1)
    assert.equal(result.orphaned, 0)

    const project = listProjects().find((candidate) => candidate.ref === ref)
    assert.ok(project)
    assert.equal(project.accountId, first.accountId)
    assert.equal(project.enabled, true)

    const run = database.prepare("SELECT COUNT(*) AS count FROM ping_runs WHERE project_ref = ?").get(ref) as { count: number }
    assert.equal(run.count, 1)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("deleting the only account that can see a project orphans and disables it, keeping its history", async () => {
  const originalFetch = globalThis.fetch
  const ref = "lonelyprojectref001"
  globalThis.fetch = async (input) => {
    if (String(input).endsWith("/projects")) {
      return new Response(JSON.stringify([{ ref, name: "Lonely", status: "ACTIVE_HEALTHY" }]), { status: 200 })
    }
    return new Response("not found", { status: 404 })
  }
  try {
    const { addAccount, deleteAccount } = await import("../src/lib/accounts")
    const { getDb, listProjects } = await import("../src/lib/db")
    const added = await addAccount("Only", "sbp_token_only_1234567890")
    const database = getDb()
    database.prepare(`INSERT INTO ping_runs (id, project_ref, started_at, status, attempt_count, trigger)
      VALUES (?, ?, ?, 'success', 1, 'manual')`)
      .run("run-lonely", ref, new Date().toISOString())

    const result = deleteAccount(added.accountId)
    assert.equal(result.deleted, true)
    assert.equal(result.rehomed, 0)
    assert.equal(result.orphaned, 1)

    const project = listProjects().find((candidate) => candidate.ref === ref)
    assert.ok(project)
    assert.equal(project.accountId, null)
    assert.equal(project.accountLabel, "غير مرتبط بحساب")
    assert.equal(project.enabled, false)

    const run = database.prepare("SELECT COUNT(*) AS count FROM ping_runs WHERE project_ref = ?").get(ref) as { count: number }
    assert.equal(run.count, 1)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("deleting an account re-homes a shared project and orphans a private one, keeping both histories", async () => {
  const originalFetch = globalThis.fetch
  const sharedRef = "sharedondelete000001"
  const privateRef = "privateondelete0001"
  let projectCalls = 0
  globalThis.fetch = async (input) => {
    if (String(input).endsWith("/projects")) {
      projectCalls += 1
      if (projectCalls === 1) {
        return new Response(JSON.stringify([{ ref: sharedRef, name: "Shared", status: "ACTIVE_HEALTHY" }]), { status: 200 })
      }
      return new Response(JSON.stringify([
        { ref: sharedRef, name: "Shared", status: "ACTIVE_HEALTHY" },
        { ref: privateRef, name: "Private", status: "ACTIVE_HEALTHY" },
      ]), { status: 200 })
    }
    return new Response("not found", { status: 404 })
  }
  try {
    const { addAccount, deleteAccount } = await import("../src/lib/accounts")
    const { getDb, listProjects } = await import("../src/lib/db")
    const survivor = await addAccount("Survivor", "sbp_token_survivor_123456")
    const doomed = await addAccount("Doomed", "sbp_token_doomed_1234567")
    const database = getDb()
    const now = new Date().toISOString()
    database.prepare("INSERT OR IGNORE INTO project_accounts (project_ref, account_id) VALUES (?, ?)").run(sharedRef, survivor.accountId)
    database.prepare(`INSERT INTO ping_runs (id, project_ref, started_at, status, attempt_count, trigger)
      VALUES (?, ?, ?, 'success', 1, 'manual')`).run("run-shared-1", sharedRef, now)
    database.prepare(`INSERT INTO ping_runs (id, project_ref, started_at, status, attempt_count, trigger)
      VALUES (?, ?, ?, 'success', 1, 'manual')`).run("run-private-1", privateRef, now)

    const result = deleteAccount(doomed.accountId)
    assert.equal(result.deleted, true)
    assert.equal(result.rehomed, 1)
    assert.equal(result.orphaned, 1)

    const projects = listProjects()
    const shared = projects.find((candidate) => candidate.ref === sharedRef)
    const privateProject = projects.find((candidate) => candidate.ref === privateRef)
    assert.ok(shared)
    assert.equal(shared.accountId, survivor.accountId)
    assert.equal(shared.enabled, true)
    assert.ok(privateProject)
    assert.equal(privateProject.accountId, null)
    assert.equal(privateProject.enabled, false)

    assert.equal((database.prepare("SELECT COUNT(*) AS count FROM ping_runs WHERE project_ref = ?").get(sharedRef) as { count: number }).count, 1)
    assert.equal((database.prepare("SELECT COUNT(*) AS count FROM ping_runs WHERE project_ref = ?").get(privateRef) as { count: number }).count, 1)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("token rotation rejects an invalid token and replaces a valid one without losing projects or history", async () => {
  const originalFetch = globalThis.fetch
  const ref = "rotatedproject00001"
  let rejectProjects = false
  globalThis.fetch = async (input) => {
    const url = String(input)
    if (url.endsWith("/projects") && rejectProjects) {
      return new Response(JSON.stringify({ message: "invalid token" }), { status: 401 })
    }
    if (url.endsWith("/projects")) {
      return new Response(JSON.stringify([{ ref, name: "Rotated", status: "ACTIVE_HEALTHY" }]), { status: 200 })
    }
    return new Response("not found", { status: 404 })
  }
  try {
    const { addAccount, rotateAccountToken } = await import("../src/lib/accounts")
    const { decryptSecret } = await import("../src/lib/crypto")
    const { getDb, listProjects } = await import("../src/lib/db")
    const added = await addAccount("Rotate", "sbp_token_old_1234567890")
    const database = getDb()
    database.prepare(`INSERT INTO ping_runs (id, project_ref, started_at, status, attempt_count, trigger)
      VALUES (?, ?, ?, 'success', 1, 'manual')`)
      .run("run-rotate", ref, new Date().toISOString())

    const storedToken = () => (database.prepare("SELECT encrypted_token FROM accounts WHERE id = ?").get(added.accountId) as { encrypted_token: string }).encrypted_token
    const before = storedToken()

    rejectProjects = true
    await assert.rejects(() => rotateAccountToken(added.accountId, "sbp_token_bad_1234567890"))
    assert.equal(storedToken(), before)

    rejectProjects = false
    await rotateAccountToken(added.accountId, "sbp_token_new_1234567890")

    assert.equal(decryptSecret(storedToken()), "sbp_token_new_1234567890")
    const project = listProjects().find((candidate) => candidate.ref === ref)
    assert.ok(project)
    assert.equal(project.accountId, added.accountId)
    const run = database.prepare("SELECT COUNT(*) AS count FROM ping_runs WHERE project_ref = ?").get(ref) as { count: number }
    assert.equal(run.count, 1)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("migrates an old-schema database without losing accounts, projects or runs", async () => {
  const { default: Database } = await import("better-sqlite3")
  const { migrate } = await import("../src/lib/db")
  const directory = mkdtempSync(join(tmpdir(), "supaaction-migrate-"))
  const file = join(directory, "old.db")
  const database = new Database(file)
  database.exec(`
    CREATE TABLE accounts (
      id TEXT PRIMARY KEY, label TEXT NOT NULL, encrypted_token TEXT NOT NULL, token_hint TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'connected', last_synced_at TEXT, last_error TEXT,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE projects (
      ref TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      name TEXT NOT NULL, organization_id TEXT, organization_slug TEXT, region TEXT,
      remote_status TEXT NOT NULL DEFAULT 'UNKNOWN', enabled INTEGER NOT NULL DEFAULT 1,
      last_ping_at TEXT, last_ping_status TEXT, last_latency_ms INTEGER, last_http_status INTEGER, last_error TEXT,
      next_ping_at TEXT, fail_streak INTEGER NOT NULL DEFAULT 0, last_restore_at TEXT,
      restore_count INTEGER NOT NULL DEFAULT 0, remote_created_at TEXT,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE ping_runs (
      id TEXT PRIMARY KEY,
      project_ref TEXT NOT NULL REFERENCES projects(ref) ON DELETE CASCADE,
      started_at TEXT NOT NULL, completed_at TEXT, status TEXT NOT NULL, latency_ms INTEGER,
      http_status INTEGER, attempt_count INTEGER NOT NULL DEFAULT 1, error TEXT,
      trigger TEXT NOT NULL DEFAULT 'scheduled'
    );
  `)
  const now = new Date().toISOString()
  database.prepare("INSERT INTO accounts (id, label, encrypted_token, token_hint, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'connected', ?, ?)")
    .run("old-acct", "Old", "v1.iv.tag.ciphertext", "sbp_...", now, now)
  database.prepare("INSERT INTO projects (ref, account_id, name, remote_status, enabled, fail_streak, restore_count, created_at, updated_at) VALUES (?, ?, ?, 'ACTIVE_HEALTHY', 1, 0, 0, ?, ?)")
    .run("oldproject000000000", "old-acct", "Old Project", now, now)
  database.prepare("INSERT INTO ping_runs (id, project_ref, started_at, status, attempt_count, trigger) VALUES (?, ?, ?, 'success', 1, 'manual')")
    .run("old-run", "oldproject000000000", now)
  database.close()

  const migrated = new Database(file)
  migrated.pragma("foreign_keys = ON")
  migrate(migrated)

  assert.ok(migrated.prepare("SELECT id FROM accounts WHERE id = 'old-acct'").get())
  const project = migrated.prepare("SELECT ref, account_id, enabled FROM projects WHERE ref = 'oldproject000000000'").get() as { ref: string; account_id: string; enabled: number }
  assert.deepEqual(project, { ref: "oldproject000000000", account_id: "old-acct", enabled: 1 })
  const runs = migrated.prepare("SELECT COUNT(*) AS count FROM ping_runs WHERE project_ref = 'oldproject000000000'").get() as { count: number }
  assert.equal(runs.count, 1)

  const accountLink = (migrated.pragma("foreign_key_list(projects)") as Array<{ from: string; on_delete: string }>).find((foreignKey) => foreignKey.from === "account_id")
  assert.equal(accountLink?.on_delete, "SET NULL")
  const accountColumn = (migrated.pragma("table_info(projects)") as Array<{ name: string; notnull: number }>).find((column) => column.name === "account_id")
  assert.equal(accountColumn?.notnull, 0)
  const visibility = migrated.prepare("SELECT COUNT(*) AS count FROM project_accounts WHERE project_ref = 'oldproject000000000' AND account_id = 'old-acct'").get() as { count: number }
  assert.equal(visibility.count, 1)
  migrated.close()
  rmSync(directory, { recursive: true, force: true })
})

test("rotates the encryption key and refuses when a token cannot be decrypted", async () => {
  const { spawnSync } = await import("node:child_process")
  const { default: Database } = await import("better-sqlite3")
  const { decryptSecret, encryptSecret } = await import("../src/lib/crypto")
  const KEY_A = "key-a-rotation-secret-that-is-long"
  const KEY_B = "key-b-rotation-secret-that-is-long"
  const previousKey = process.env.ENCRYPTION_KEY
  const directory = mkdtempSync(join(tmpdir(), "supaaction-rotate-"))
  const scriptPath = join(process.cwd(), "scripts", "rotate-encryption-key.mjs")

  process.env.ENCRYPTION_KEY = KEY_A
  const encryptedA = encryptSecret("sbp_rotate_token_1234567890")
  const file = join(directory, "rotate.db")
  const database = new Database(file)
  database.exec("CREATE TABLE accounts (id TEXT PRIMARY KEY, encrypted_token TEXT NOT NULL)")
  database.prepare("INSERT INTO accounts (id, encrypted_token) VALUES (?, ?)").run("acct-1", encryptedA)
  database.close()

  const rotated = spawnSync(process.execPath, [scriptPath], {
    env: { ...process.env, DATABASE_PATH: file, OLD_ENCRYPTION_KEY: KEY_A, ENCRYPTION_KEY: KEY_B },
    encoding: "utf8",
  })
  assert.equal(rotated.status, 0, rotated.stderr || rotated.stdout)

  process.env.ENCRYPTION_KEY = KEY_B
  const rotatedDatabase = new Database(file, { readonly: true })
  const rotatedRow = rotatedDatabase.prepare("SELECT encrypted_token FROM accounts WHERE id = 'acct-1'").get() as { encrypted_token: string }
  rotatedDatabase.close()
  assert.equal(decryptSecret(rotatedRow.encrypted_token), "sbp_rotate_token_1234567890")

  process.env.ENCRYPTION_KEY = KEY_A
  const encryptedGood = encryptSecret("sbp_good_token_1234567890")
  const refuseFile = join(directory, "refuse.db")
  const refuseDatabase = new Database(refuseFile)
  refuseDatabase.exec("CREATE TABLE accounts (id TEXT PRIMARY KEY, encrypted_token TEXT NOT NULL)")
  refuseDatabase.prepare("INSERT INTO accounts (id, encrypted_token) VALUES (?, ?)").run("good", encryptedGood)
  refuseDatabase.prepare("INSERT INTO accounts (id, encrypted_token) VALUES (?, ?)").run("bad", "garbage-token")
  refuseDatabase.close()

  const refused = spawnSync(process.execPath, [scriptPath], {
    env: { ...process.env, DATABASE_PATH: refuseFile, OLD_ENCRYPTION_KEY: KEY_A, ENCRYPTION_KEY: KEY_B },
    encoding: "utf8",
  })
  assert.notEqual(refused.status, 0)

  process.env.ENCRYPTION_KEY = KEY_A
  const afterRefusal = new Database(refuseFile, { readonly: true })
  const goodRow = afterRefusal.prepare("SELECT encrypted_token FROM accounts WHERE id = 'good'").get() as { encrypted_token: string }
  afterRefusal.close()
  assert.equal(decryptSecret(goodRow.encrypted_token), "sbp_good_token_1234567890")

  process.env.ENCRYPTION_KEY = previousKey
  rmSync(directory, { recursive: true, force: true })
})

test("backup script produces a valid SQLite database with the same account rows", async () => {
  const { spawnSync } = await import("node:child_process")
  const { default: Database } = await import("better-sqlite3")
  const { migrate } = await import("../src/lib/db")
  const directory = mkdtempSync(join(tmpdir(), "supaaction-backup-"))
  const source = join(directory, "source.db")
  const destination = join(directory, "backup.db")
  try {
    const database = new Database(source)
    migrate(database)
    const now = new Date().toISOString()
    const insert = database.prepare(`INSERT INTO accounts
      (id, label, encrypted_token, token_hint, status, last_synced_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'connected', ?, ?, ?)`)
    insert.run("backup-acct-1", "Backup One", "ciphertext-1", "sbp_...1", now, now, now)
    insert.run("backup-acct-2", "Backup Two", "ciphertext-2", "sbp_...2", now, now, now)
    database.close()

    const result = spawnSync(process.execPath, [join(process.cwd(), "scripts", "backup.mjs")], {
      env: { ...process.env, DATABASE_PATH: source, BACKUP_PATH: destination },
      encoding: "utf8",
    })
    assert.equal(result.status, 0, result.stderr || result.stdout)

    const backup = new Database(destination, { readonly: true })
    const rows = backup.prepare("SELECT id, label, encrypted_token, token_hint FROM accounts ORDER BY id")
      .all() as Array<{ id: string; label: string; encrypted_token: string; token_hint: string }>
    backup.close()
    assert.deepEqual(rows, [
      { id: "backup-acct-1", label: "Backup One", encrypted_token: "ciphertext-1", token_hint: "sbp_...1" },
      { id: "backup-acct-2", label: "Backup Two", encrypted_token: "ciphertext-2", token_hint: "sbp_...2" },
    ])
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
