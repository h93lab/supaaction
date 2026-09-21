import { createHash } from "node:crypto"

const MIN_SECRET_LENGTH = 32
const MIN_APP_PASSWORD_LENGTH = 12
const SAMPLE_APP_PASSWORD = "change-this-admin-password"

export class AppPasswordConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AppPasswordConfigError"
  }
}

function requiredSecret(name: "APP_PASSWORD" | "SESSION_SECRET" | "ENCRYPTION_KEY") {
  const value = process.env[name]?.trim()
  if (value) {
    if (process.env.NODE_ENV === "production") {
      if (name === "APP_PASSWORD") {
        if (value.length < MIN_APP_PASSWORD_LENGTH) {
          throw new AppPasswordConfigError(`APP_PASSWORD must be at least ${MIN_APP_PASSWORD_LENGTH} characters in production`)
        }
        if (value === SAMPLE_APP_PASSWORD) {
          throw new AppPasswordConfigError(`APP_PASSWORD must be changed from the sample value "${SAMPLE_APP_PASSWORD}" in production`)
        }
      } else if (value.length < MIN_SECRET_LENGTH) {
        throw new Error(`${name} must be at least ${MIN_SECRET_LENGTH} characters in production`)
      }
    }
    return value
  }

  if (process.env.NODE_ENV !== "production") {
    return `supaaction-development-only-${name.toLowerCase()}-change-me`
  }

  throw new Error(`${name} is required in production`)
}

export function appPassword() {
  return requiredSecret("APP_PASSWORD")
}

export function sessionSecret() {
  return requiredSecret("SESSION_SECRET")
}

export function encryptionKey() {
  return createHash("sha256").update(requiredSecret("ENCRYPTION_KEY")).digest()
}

export function databasePath() {
  return process.env.DATABASE_PATH?.trim() || ".data/supaaction.db"
}

export function appUrl() {
  return (process.env.APP_URL?.trim() || "http://localhost:3000").replace(/\/$/, "")
}

export function sessionTtlSeconds() {
  const hours = Number(process.env.SESSION_TTL_HOURS || 24)
  if (!Number.isFinite(hours) || hours < 1 || hours > 720) return 24 * 60 * 60
  return Math.floor(hours * 60 * 60)
}

export function schedulerEnabled() {
  return process.env.SCHEDULER_ENABLED?.trim().toLowerCase() !== "false"
}

export function trustedProxy() {
  return process.env.TRUSTED_PROXY?.trim().toLowerCase() === "true"
}
