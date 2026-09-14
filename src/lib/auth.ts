import { createHmac, timingSafeEqual } from "node:crypto"
import { cookies } from "next/headers"
import { appPassword, appUrl, sessionSecret } from "@/lib/env"

const COOKIE_NAME = "supaaction_session"
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30
const LOGIN_WINDOW_MS = 15 * 60 * 1000
const LOGIN_MAX_ATTEMPTS = 5

type LoginAttempt = { count: number; resetsAt: number }

declare global {
  var __supaactionLoginAttempts: Map<string, LoginAttempt> | undefined
}

const loginAttempts = globalThis.__supaactionLoginAttempts ?? new Map<string, LoginAttempt>()
globalThis.__supaactionLoginAttempts = loginAttempts

function sign(value: string) {
  return createHmac("sha256", sessionSecret()).update(value).digest("base64url")
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}

export function verifyPassword(candidate: string) {
  return safeEqual(candidate, appPassword())
}

export function loginRateLimit(key: string) {
  const now = Date.now()
  const attempt = loginAttempts.get(key)
  if (!attempt || attempt.resetsAt <= now) {
    loginAttempts.delete(key)
    return { allowed: true, retryAfterSeconds: 0 }
  }
  return {
    allowed: attempt.count < LOGIN_MAX_ATTEMPTS,
    retryAfterSeconds: Math.ceil((attempt.resetsAt - now) / 1000),
  }
}

export function recordFailedLogin(key: string) {
  const now = Date.now()
  const current = loginAttempts.get(key)
  if (!current || current.resetsAt <= now) {
    loginAttempts.set(key, { count: 1, resetsAt: now + LOGIN_WINDOW_MS })
  } else {
    current.count += 1
  }
}

export function clearFailedLogins(key: string) {
  loginAttempts.delete(key)
}

export function createSessionToken() {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
  const payload = Buffer.from(JSON.stringify({ sub: "admin", exp: expiresAt })).toString("base64url")
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
    }
    return parsed.sub === "admin" && typeof parsed.exp === "number" && parsed.exp > Date.now() / 1000
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
    maxAge: SESSION_TTL_SECONDS,
  })
}

export async function clearSessionCookie() {
  const store = await cookies()
  store.set(COOKIE_NAME, "", { httpOnly: true, sameSite: "strict", path: "/", maxAge: 0 })
}
