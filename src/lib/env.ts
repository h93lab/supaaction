import { createHash } from "node:crypto"

function requiredSecret(name: "APP_PASSWORD" | "SESSION_SECRET" | "ENCRYPTION_KEY") {
  const value = process.env[name]?.trim()
  if (value) return value

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
