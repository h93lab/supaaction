import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

export function PaginationNav({
  page,
  totalPages,
  path,
  query,
}: {
  page: number
  totalPages: number
  path: string
  query?: Record<string, string | undefined>
}) {
  if (totalPages <= 1) return null

  const href = (nextPage: number) => {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(query || {})) if (value) params.set(key, value)
    params.set("page", String(nextPage))
    return `${path}?${params.toString()}`
  }

  return (
    <nav className="flex items-center justify-between gap-4 border-t px-4 py-3" aria-label="التنقل بين الصفحات">
      <Button variant="outline" size="sm" asChild={page > 1} disabled={page <= 1}>
        {page > 1 ? <Link href={href(page - 1)}><ChevronRight className="size-4" />السابق</Link> : <span><ChevronRight className="size-4" />السابق</span>}
      </Button>
      <span className="text-sm text-muted-foreground">صفحة {page} من {totalPages}</span>
      <Button variant="outline" size="sm" asChild={page < totalPages} disabled={page >= totalPages}>
        {page < totalPages ? <Link href={href(page + 1)}>التالي<ChevronLeft className="size-4" /></Link> : <span>التالي<ChevronLeft className="size-4" /></span>}
      </Button>
    </nav>
  )
}
