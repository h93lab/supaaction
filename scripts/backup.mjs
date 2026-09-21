import fs from "node:fs"
import path from "node:path"
import Database from "better-sqlite3"

const databaseFile = path.resolve(process.env.DATABASE_PATH?.trim() || ".data/supaaction.db")

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-")
}

function defaultDestination() {
  const extension = path.extname(databaseFile) || ".db"
  const base = path.basename(databaseFile, extension)
  return path.join(path.dirname(databaseFile), `${base}-backup-${timestamp()}${extension}`)
}

function resolveDestination() {
  const fromArgs = process.argv[2]?.trim()
  const fromEnv = process.env.BACKUP_PATH?.trim()
  return path.resolve(fromArgs || fromEnv || defaultDestination())
}

function run() {
  const destination = resolveDestination()
  if (!fs.existsSync(databaseFile)) throw new Error(`database not found at ${databaseFile}`)
  if (fs.existsSync(destination)) throw new Error(`refusing to overwrite existing file ${destination}`)
  fs.mkdirSync(path.dirname(destination), { recursive: true })

  const database = new Database(databaseFile, { readonly: true, fileMustExist: true })
  try {
    database.prepare("VACUUM INTO ?").run(destination)
  } finally {
    database.close()
  }

  const { size } = fs.statSync(destination)
  console.log(`wrote ${destination} (${size} bytes)`)
}

try {
  run()
} catch (error) {
  console.error(`backup failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}
