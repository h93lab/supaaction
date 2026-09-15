import { PageHeading } from "@/components/page-heading"
import { PingButton } from "@/components/ping-button"
import { ProjectsTable } from "@/components/projects-table"
import { PaginationNav } from "@/components/pagination-nav"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { getSettings, listProjectsPage } from "@/lib/db"

export const dynamic = "force-dynamic"

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ page?: string; q?: string }> }) {
  const params = await searchParams
  const settings = getSettings()
  const query = params.q?.trim() || ""
  const projects = listProjectsPage(Number(params.page) || 1, 25, query)
  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHeading title="المشاريع" description={`كل المشاريع المتاحة للحسابات المتصلة. التنشيط الافتراضي كل ${settings.pingIntervalHours} ساعة.`} actions={<PingButton />} />
      <Card className="overflow-hidden">
        <form className="flex flex-col gap-3 border-b p-4 sm:flex-row" method="get">
          <Input name="q" defaultValue={query} aria-label="البحث في المشاريع" placeholder="ابحث بالاسم أو المعرّف أو الحساب..." className="max-w-md" />
          <Button type="submit" variant="outline">بحث</Button>
          {query && <Button asChild type="button" variant="ghost"><a href="/projects">مسح البحث</a></Button>}
          <span className="self-center text-sm text-muted-foreground sm:me-auto">{projects.total} مشروع</span>
        </form>
        <CardContent className="p-0"><ProjectsTable projects={projects.items} timeZone={settings.timezone} /></CardContent>
        <PaginationNav page={projects.page} totalPages={projects.totalPages} path="/projects" query={{ q: query }} />
      </Card>
    </div>
  )
}
