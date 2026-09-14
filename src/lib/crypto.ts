import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"
import { encryptionKey } from "@/lib/env"

const VERSION = "v1"

export function encryptSecret(value: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".")
}

export function decryptSecret(payload: string) {
  const [version, ivPart, tagPart, ciphertextPart] = payload.split(".")
  if (version !== VERSION || !ivPart || !tagPart || !ciphertextPart) {
    throw new Error("Stored credential has an unsupported format")
  }

  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivPart, "base64url"))
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"))
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextPart, "base64url")),
    decipher.final(),
  ]).toString("utf8")
}

export function tokenHint(token: string) {
  if (token.length <= 10) return "••••••••"
  return `${token.slice(0, 4)}••••${token.slice(-4)}`
}
