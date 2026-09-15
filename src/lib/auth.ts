import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto"
import { cookies } from "next/headers"
import { getDb } from "@/lib/db"
import { appPassword, appUrl, sessionSecret, sessionTtlSeconds } from "@/lib/env"

const COOKIE_NAME = "supaaction_session"
const LOGIN_WINDOW_MS = 15 * 60 * 1000
const LOGIN_MAX_ATTEMPTS = 10
type AdminAuthRow = { password_salt: string; password_hash: string; session_version: number }

function sign(value: string) {
  return createHmac("sha256", sessionSecret()).update(value).digest("base64url")
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}

function getAdminAuth() {
  return getDb().prepare("SELECT password_salt, password_hash, session_version FROM admin_auth WHERE id = 1")
    .get() as AdminAuthRow | undefined
}

function derivePasswordHash(password: string, salt: string) {
  return scryptSync(password, salt, 64)
}

export function verifyPassword(candidate: string) {
  const stored = getAdminAuth()
  if (!stored) return safeEqual(candidate, appPassword())

  try {
    const actual = derivePasswordHash(candidate, stored.password_salt)
    const expected = Buffer.from(stored.password_hash, "hex")
    return actual.length === expected.length && timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}

export function setAdminPassword(password: string) {
  const salt = randomBytes(32).toString("hex")
  const hash = derivePasswordHash(password, salt).toString("hex")
  const now = new Date().toISOString()
  getDb().prepare(`
    INSERT INTO admin_auth (id, password_salt, password_hash, session_version, updated_at)
    VALUES (1, ?, ?, 1, ?)
    ON CONFLICT(id) DO UPDATE SET
      password_salt = excluded.password_salt,
      password_hash = excluded.password_hash,
      session_version = admin_auth.session_version + 1,
      updated_at = excluded.updated_at
  `).run(salt, hash, now)
}

function getSessionVersion() {
  return getAdminAuth()?.session_version ?? 0
}

export function loginRateLimit(key: string) {
  const now = Date.now()
  const attempt = getDb().prepare("SELECT attempt_count, resets_at FROM auth_attempts WHERE key = ?").get(key) as
    { attempt_count: number; resets_at: number } | undefined
  if (!attempt || attempt.resets_at <= now) {
    getDb().prepare("DELETE FROM auth_attempts WHERE key = ? OR resets_at <= ?").run(key, now)
    return { allowed: true, retryAfterSeconds: 0 }
  }
  return {
    allowed: attempt.attempt_count < LOGIN_MAX_ATTEMPTS,
    retryAfterSeconds: Math.ceil((attempt.resets_at - now) / 1000),
  }
}

export function recordFailedLogin(key: string) {
  const now = Date.now()
  getDb().prepare(`
    INSERT INTO auth_attempts (key, attempt_count, resets_at) VALUES (?, 1, ?)
    ON CONFLICT(key) DO UPDATE SET
      attempt_count = CASE WHEN auth_attempts.resets_at <= ? THEN 1 ELSE auth_attempts.attempt_count + 1 END,
      resets_at = CASE WHEN auth_attempts.resets_at <= ? THEN excluded.resets_at ELSE auth_attempts.resets_at END
  `).run(key, now + LOGIN_WINDOW_MS, now, now)
}

export function clearFailedLogins(key: string) {
  getDb().prepare("DELETE FROM auth_attempts WHERE key = ?").run(key)
}

export function createSessionToken() {
  const expiresAt = Math.floor(Date.now() / 1000) + sessionTtlSeconds()
  const payload = Buffer.from(JSON.stringify({ sub: "admin", exp: expiresAt, ver: getSessionVersion() })).toString("base64url")
  return `${payload}.${sign(payload)}`
}

export function verifySessionToken(token?: string) {
  if (!token) return false
  const [payload, signature] = token.split(".")
  if (!payload || !signature || !safeEqual(signature, sign(payload))) return false

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      sub?: string
      exp?: number
      ver?: number
    }
    return parsed.sub === "admin" && typeof parsed.exp === "number" && parsed.exp > Date.now() / 1000 &&
      parsed.ver === getSessionVersion()
  } catch {
    return false
  }
}

export async function isAuthenticated() {
  const store = await cookies()
  return verifySessionToken(store.get(COOKIE_NAME)?.value)
}

export async function setSessionCookie() {
  const store = await cookies()
  store.set(COOKIE_NAME, createSessionToken(), {
    httpOnly: true,
    sameSite: "strict",
    secure: appUrl().startsWith("https://"),
    path: "/",
    maxAge: sessionTtlSeconds(),
  })
}

export async function clearSessionCookie() {
  const store = await cookies()
  store.set(COOKIE_NAME, "", { httpOnly: true, sameSite: "strict", path: "/", maxAge: 0 })
}
