import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test, { after } from "node:test"

const testDir = mkdtempSync(join(tmpdir(), "supaaction-test-"))
process.env.DATABASE_PATH = join(testDir, "test.db")
process.env.ENCRYPTION_KEY = "test-encryption-secret-that-is-long-enough"
process.env.SESSION_SECRET = "test-session-secret-that-is-long-enough"
process.env.APP_PASSWORD = "test-password"

after(() => rmSync(testDir, { recursive: true, force: true }))

test("encrypts and decrypts credentials without storing plaintext", async () => {
  const { decryptSecret, encryptSecret } = await import("../src/lib/crypto")
  const plaintext = "sbp_example_token_1234567890"
  const encrypted = encryptSecret(plaintext)
  assert.notEqual(encrypted, plaintext)
  assert.equal(encrypted.includes(plaintext), false)
  assert.equal(decryptSecret(encrypted), plaintext)
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
  for (let attempt = 0; attempt < 5; attempt += 1) recordFailedLogin(key)
  assert.equal(loginRateLimit(key).allowed, false)
  clearFailedLogins(key)
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
    const { listProjects, listRecentRuns } = await import("../src/lib/db")
    const { pingProjects } = await import("../src/lib/pinger")
    const added = await addAccount("Demo account", "sbp_example_token_1234567890")
    assert.equal(added.projectCount, 1)
    assert.equal(listProjects()[0].name, "Demo")
    const results = await pingProjects(undefined, "manual")
    assert.equal(results[0].status, "success")
    assert.equal(listRecentRuns(1)[0].httpStatus, 201)
    assert.equal(calls.some((call) => call.url.endsWith("/projects") && call.method === "GET"), true)
    assert.equal(calls.some((call) => call.url.includes("/database/query/read-only") && call.method === "POST"), true)
  } finally {
    globalThis.fetch = originalFetch
  }
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
