const API_BASE = "https://api.supabase.com/v1"

export type SupabaseProject = {
  id?: string
  ref: string
  name: string
  organization_id?: string
  organization_slug?: string
  region?: string
  status?: string
  created_at?: string
}

export class SupabaseApiError extends Error {
  constructor(message: string, public status: number | null, public retryable: boolean) {
    super(message)
    this.name = "SupabaseApiError"
  }
}

async function managementRequest<T>(token: string, path: string, init: RequestInit = {}, timeoutSeconds = 20) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutSeconds * 1000)
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
      signal: controller.signal,
    })
    const text = await response.text()
    let data: unknown = null
    if (text) {
      try { data = JSON.parse(text) } catch { data = text }
    }
    if (!response.ok) {
      const detail = typeof data === "object" && data && "message" in data ? String(data.message) : String(data || response.statusText)
      const retryable = response.status === 429 || (response.status >= 500 && response.status !== 540)
      throw new SupabaseApiError(detail, response.status, retryable)
    }
    return { data: data as T, status: response.status }
  } catch (error) {
    if (error instanceof SupabaseApiError) throw error
    if (error instanceof Error && error.name === "AbortError") {
      throw new SupabaseApiError(`Request timed out after ${timeoutSeconds}s`, null, true)
    }
    throw new SupabaseApiError(error instanceof Error ? error.message : "Network request failed", null, true)
  } finally {
    clearTimeout(timeout)
  }
}

export async function fetchSupabaseProjects(token: string) {
  const { data } = await managementRequest<SupabaseProject[]>(token, "/projects")
  if (!Array.isArray(data)) throw new SupabaseApiError("Supabase returned an invalid projects response", null, false)
  return data.filter((project) => project.ref && project.name)
}

export async function queryProject(token: string, ref: string, timeoutSeconds: number) {
  return managementRequest<unknown>(token, `/projects/${encodeURIComponent(ref)}/database/query/read-only`, {
    method: "POST",
    body: JSON.stringify({ query: "select 1 as supaaction_ping", parameters: [] }),
  }, timeoutSeconds)
}
