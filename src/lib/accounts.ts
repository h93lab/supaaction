import { randomUUID } from "node:crypto"
import { decryptSecret, encryptSecret, tokenHint } from "@/lib/crypto"
import { getDb } from "@/lib/db"
import { fetchSupabaseProjects } from "@/lib/supabase-management"

export async function addAccount(label: string, token: string) {
  const projects = await fetchSupabaseProjects(token)
  const now = new Date().toISOString()
  const accountId = randomUUID()
  const database = getDb()
  database.transaction(() => {
    database.prepare(`INSERT INTO accounts
      (id, label, encrypted_token, token_hint, status, last_synced_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'connected', ?, ?, ?)`)
      .run(accountId, label, encryptSecret(token), tokenHint(token), now, now, now)
    upsertProjects(accountId, projects, now)
  })()
  return { accountId, projectCount: projects.length }
}

function upsertProjects(accountId: string, projects: Awaited<ReturnType<typeof fetchSupabaseProjects>>, now: string) {
  const database = getDb()
  const statement = database.prepare(`
    INSERT INTO projects
      (ref, account_id, name, organization_id, organization_slug, region, remote_status, next_ping_at,
       remote_created_at, created_at, updated_at)
    VALUES (@ref, @accountId, @name, @organizationId, @organizationSlug, @region, @status, @nextPingAt,
            @remoteCreatedAt, @createdAt, @updatedAt)
    ON CONFLICT(ref) DO UPDATE SET
      account_id = excluded.account_id, name = excluded.name, organization_id = excluded.organization_id,
      organization_slug = excluded.organization_slug, region = excluded.region,
      remote_status = excluded.remote_status, remote_created_at = excluded.remote_created_at,
      updated_at = excluded.updated_at
  `)
  for (const project of projects) {
    statement.run({
      ref: project.ref, accountId, name: project.name, organizationId: project.organization_id ?? null,
      organizationSlug: project.organization_slug ?? null, region: project.region ?? null,
      status: project.status ?? "UNKNOWN", nextPingAt: now, remoteCreatedAt: project.created_at ?? null,
      createdAt: now, updatedAt: now,
    })
  }
}

export async function syncAccount(accountId: string) {
  const database = getDb()
  const account = database.prepare("SELECT encrypted_token FROM accounts WHERE id = ?").get(accountId) as { encrypted_token: string } | undefined
  if (!account) throw new Error("Account not found")

  try {
    const projects = await fetchSupabaseProjects(decryptSecret(account.encrypted_token))
    const now = new Date().toISOString()
    database.transaction(() => {
      upsertProjects(accountId, projects, now)
      database.prepare("UPDATE accounts SET status = 'connected', last_synced_at = ?, last_error = NULL, updated_at = ? WHERE id = ?")
        .run(now, now, accountId)
    })()
    return projects.length
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed"
    database.prepare("UPDATE accounts SET status = 'error', last_error = ?, updated_at = ? WHERE id = ?")
      .run(message, new Date().toISOString(), accountId)
    throw error
  }
}

export async function syncAllAccounts() {
  const ids = getDb().prepare("SELECT id FROM accounts").all() as Array<{ id: string }>
  const results = []
  for (const { id } of ids) {
    try { results.push({ id, ok: true, count: await syncAccount(id) }) }
    catch (error) { results.push({ id, ok: false, error: error instanceof Error ? error.message : "Sync failed" }) }
  }
  return results
}

export function deleteAccount(accountId: string) {
  return getDb().prepare("DELETE FROM accounts WHERE id = ?").run(accountId).changes > 0
}

export function getAccountToken(accountId: string) {
  const row = getDb().prepare("SELECT encrypted_token FROM accounts WHERE id = ?").get(accountId) as { encrypted_token: string } | undefined
  if (!row) throw new Error("Account not found")
  return decryptSecret(row.encrypted_token)
}
