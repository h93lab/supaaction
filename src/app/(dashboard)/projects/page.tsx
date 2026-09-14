import { PageHeading } from "@/components/page-heading"
import { PingButton } from "@/components/ping-button"
import { ProjectsTable } from "@/components/projects-table"
import { Card, CardContent } from "@/components/ui/card"
import { getSettings, listProjects } from "@/lib/db"

export const dynamic = "force-dynamic"

export default function ProjectsPage() {
  const settings = getSettings()
  return <div className="mx-auto max-w-[1500px]"><PageHeading title="المشاريع" description={`كل المشاريع المتاحة للحسابات المتصلة. التنشيط الافتراضي كل ${settings.pingIntervalHours} ساعة.`} actions={<PingButton />} /><Card className="overflow-hidden"><CardContent className="p-0"><ProjectsTable projects={listProjects()} timeZone={settings.timezone} /></CardContent></Card></div>
}
