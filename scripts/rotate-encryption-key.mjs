import fs from "node:fs"
import path from "node:path"
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import Database from "better-sqlite3"

const VERSION = "v1"

function keyMaterial(secret) {
  return createHash("sha256").update(secret).digest()
}

function encrypt(value, key) {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".")
}

function decrypt(payload, key) {
  const [version, ivPart, tagPart, ciphertextPart] = payload.split(".")
  if (version !== VERSION || !ivPart || !tagPart || !ciphertextPart) {
    throw new Error("Stored credential has an unsupported format")
  }
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivPart, "base64url"))
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"))
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextPart, "base64url")),
    decipher.final(),
  ]).toString("utf8")
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-")
}

function runBackup(databaseFile) {
  const backupScript = fileURLToPath(new URL("./backup.mjs", import.meta.url))
  const extension = path.extname(databaseFile) || ".db"
  const base = path.basename(databaseFile, extension)
  const destination = path.join(path.dirname(databaseFile), `${base}-backup-${timestamp()}${extension}`)
  const result = spawnSync(process.execPath, [backupScript, destination], {
    env: { ...process.env, DATABASE_PATH: databaseFile },
    stdio: "inherit",
  })
  if (result.status !== 0) throw new Error("backup failed; aborting rotation")
  return destination
}

function run() {
  const oldKeySecret = process.env.OLD_ENCRYPTION_KEY?.trim()
  const newKeySecret = process.env.ENCRYPTION_KEY?.trim()
  if (!oldKeySecret || !newKeySecret) {
    throw new Error("OLD_ENCRYPTION_KEY and ENCRYPTION_KEY are both required")
  }
  if (oldKeySecret === newKeySecret) {
    throw new Error("OLD_ENCRYPTION_KEY and ENCRYPTION_KEY must differ")
  }

  const databaseFile = path.resolve(process.env.DATABASE_PATH?.trim() || ".data/supaaction.db")
  if (!fs.existsSync(databaseFile)) throw new Error(`database not found at ${databaseFile}`)

  const oldKey = keyMaterial(oldKeySecret)
  const newKey = keyMaterial(newKeySecret)

  const plaintexts = new Map()
  {
    const readDatabase = new Database(databaseFile, { readonly: true, fileMustExist: true })
    try {
      const rows = readDatabase.prepare("SELECT id, encrypted_token FROM accounts").all()
      for (const row of rows) {
        plaintexts.set(row.id, decrypt(row.encrypted_token, oldKey))
      }
    } finally {
      readDatabase.close()
    }
  }

  if (plaintexts.size === 0) {
    console.log("no accounts to rotate")
    return
  }

  const backupDestination = runBackup(databaseFile)

  const database = new Database(databaseFile)
  database.pragma("busy_timeout = 5000")
  try {
    database.transaction(() => {
      for (const [id, plaintext] of plaintexts) {
        database.prepare("UPDATE accounts SET encrypted_token = ? WHERE id = ?")
          .run(encrypt(plaintext, newKey), id)
      }
    })()
  } finally {
    database.close()
  }

  console.log(`rotated ${plaintexts.size} token(s)`)
  console.log(`backup written to ${backupDestination}`)
}

try {
  run()
} catch (error) {
  console.error(`rotation failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}
