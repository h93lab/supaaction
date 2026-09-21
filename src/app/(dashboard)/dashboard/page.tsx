import Link from "next/link"
import { Activity, CircleAlert, FolderKanban, ShieldCheck, Users } from "lucide-react"
import { HealthBanner } from "@/components/health-banner"
import { PageHeading } from "@/components/page-heading"
import { PingButton } from "@/components/ping-button"
import { ProjectsTable } from "@/components/projects-table"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getDashboardData } from "@/lib/db"
import { formatDate } from "@/lib/format"

export const dynamic = "force-dynamic"

export default function DashboardPage() {
  const data = getDashboardData()
  const stats = [
    { title: "الحسابات المتصلة", value: data.totals.accounts, icon: Users, note: "حسابات Supabase" },
    { title: "إجمالي المشاريع", value: data.totals.projects, icon: FolderKanban, note: "تم اكتشافها تلقائيًا" },
    { title: "الحماية مفعلة", value: data.totals.protected, icon: ShieldCheck, note: `كل ${data.settings.pingIntervalHours} ساعة` },
    { title: "تحتاج انتباه", value: data.totals.failed, icon: CircleAlert, note: "آخر محاولة فاشلة" },
  ]

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHeading title="نظرة عامة" description="تابع حالة كل مشاريعك وعمليات التنشيط المجدولة." actions={<><Button variant="outline" asChild><Link href="/accounts">إدارة الحسابات</Link></Button>{data.totals.projects > 0 && <PingButton />}</>} />
      {!data.totals.accounts && !data.totals.projects ? (
        <Card className="py-10 text-center">
          <CardContent><Users className="mx-auto mb-4 size-10 text-muted-foreground" /><h2 className="text-lg font-semibold">ابدأ بربط حساب Supabase</h2><p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">لا توجد حسابات متصلة بعد. أضف حسابًا لاكتشاف المشاريع وحمايتها تلقائيًا.</p><Button className="mt-5" asChild><Link href="/accounts">إضافة حساب</Link></Button></CardContent>
        </Card>
      ) : <>
        <HealthBanner
          projects={data.projects}
          accountErrors={data.accountErrors}
          schedulerHeartbeat={data.schedulerHeartbeat}
          pingSweepHeartbeat={data.pingSweepHeartbeat}
          lastSuccessfulPingAt={data.lastSuccessfulPingAt}
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{stats.map((stat) => <Card key={stat.title}><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle><stat.icon className="size-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-3xl font-semibold tracking-tight">{stat.value}</div><p className="mt-1 text-xs text-muted-foreground">{stat.note}</p></CardContent></Card>)}</div>
        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,.7fr)]">
          <Card className="overflow-hidden"><CardHeader className="flex flex-row items-center justify-between"><div><CardTitle>حالة المشاريع</CardTitle><CardDescription>آخر نتيجة للمشاريع المكتشفة</CardDescription></div><Button variant="outline" size="sm" asChild><Link href="/projects">عرض الكل</Link></Button></CardHeader><CardContent className="p-0"><ProjectsTable projects={data.projects} timeZone={data.settings.timezone} compact /></CardContent></Card>
          <Card><CardHeader><CardTitle>آخر النشاطات</CardTitle><CardDescription>أحدث محاولات التنشيط</CardDescription></CardHeader><CardContent>{data.recentRuns.length ? <div className="space-y-4">{data.recentRuns.slice(0, 6).map((run) => <div key={run.id} className="flex items-start gap-3"><div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted"><Activity className="size-4" /></div><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><p className="truncate text-sm font-medium">{run.projectName}</p><StatusBadge status={run.status} /></div><p className="mt-1 text-xs text-muted-foreground">{formatDate(run.completedAt, data.settings.timezone)} · {run.latencyMs ?? 0}ms</p></div></div>)}</div> : <div className="flex min-h-44 items-center justify-center text-sm text-muted-foreground">لا توجد عمليات بعد</div>}<Button variant="outline" className="mt-5 w-full" asChild><Link href="/activity">فتح السجل الكامل</Link></Button></CardContent></Card>
        </div>
      </>}
    </div>
  )
}
