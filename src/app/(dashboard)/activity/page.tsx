import { PageHeading } from "@/components/page-heading"
import { PaginationNav } from "@/components/pagination-nav"
import { StatusBadge } from "@/components/status-badge"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getSettings, listAuditLogs, listRecentRunsPage } from "@/lib/db"
import { formatDate, shortRef } from "@/lib/format"

export const dynamic = "force-dynamic"

const auditLabels: Record<string, string> = {
  "auth.login": "تسجيل دخول",
  "auth.logout": "تسجيل خروج",
  "account.added": "إضافة حساب",
  "account.deleted": "حذف حساب",
  "account.synced": "مزامنة حساب",
  "password.changed": "تغيير كلمة المرور",
  "project.protection_changed": "تغيير الحماية",
  "projects.pinged": "تنشيط يدوي",
  "settings.updated": "تحديث الإعدادات",
}

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const params = await searchParams
  const runs = listRecentRunsPage(Number(params.page) || 1, 50)
  const auditLogs = listAuditLogs(50)
  const { timezone } = getSettings()

  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <PageHeading title="سجل النشاط" description="تفاصيل عمليات التنشيط والتغييرات الإدارية المهمة." />
      <Card className="overflow-hidden">
        <CardHeader><CardTitle className="text-base">عمليات التنشيط</CardTitle><CardDescription>{runs.total} عملية مسجلة، تعرض 50 عملية في الصفحة.</CardDescription></CardHeader>
        <CardContent className="p-0">
          {runs.items.length ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>المشروع</TableHead><TableHead>وقت التنفيذ</TableHead><TableHead>المصدر</TableHead><TableHead>النتيجة</TableHead><TableHead>HTTP</TableHead><TableHead>الزمن</TableHead><TableHead>المحاولات</TableHead><TableHead>التفاصيل</TableHead></TableRow></TableHeader>
                <TableBody>{runs.items.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell><div className="font-medium">{run.projectName}</div><div className="font-mono text-xs text-muted-foreground" dir="ltr">{shortRef(run.projectRef)}</div></TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(run.completedAt, timezone)}</TableCell>
                    <TableCell><Badge variant="outline">{run.trigger === "manual" ? "يدوي" : "مجدول"}</Badge></TableCell>
                    <TableCell><StatusBadge status={run.status} /></TableCell>
                    <TableCell className="font-mono text-xs">{run.httpStatus ?? "—"}</TableCell><TableCell className="font-mono text-xs">{run.latencyMs ?? 0}ms</TableCell><TableCell>{run.attemptCount}</TableCell>
                    <TableCell className="max-w-xs truncate text-xs text-muted-foreground" title={run.error ?? "تم تنفيذ select 1 بنجاح"}>{run.error ?? "select 1"}</TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            </div>
          ) : <div className="flex min-h-48 flex-col items-center justify-center text-center"><p className="font-medium">سجل التنشيط فارغ</p><p className="mt-1 text-sm text-muted-foreground">ستظهر النتائج هنا بعد أول تشغيل.</p></div>}
        </CardContent>
        <PaginationNav page={runs.page} totalPages={runs.totalPages} path="/activity" />
      </Card>

      <Card className="overflow-hidden">
        <CardHeader><CardTitle className="text-base">سجل الإدارة والأمان</CardTitle><CardDescription>آخر التغييرات الإدارية دون تسجيل كلمات المرور أو التوكنات.</CardDescription></CardHeader>
        <CardContent className="p-0">
          {auditLogs.length ? (
            <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>الإجراء</TableHead><TableHead>التفاصيل</TableHead><TableHead>الوقت</TableHead></TableRow></TableHeader><TableBody>{auditLogs.map((entry) => <TableRow key={entry.id}><TableCell><Badge variant="secondary">{auditLabels[entry.action] || entry.action}</Badge></TableCell><TableCell>{entry.summary}</TableCell><TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(entry.createdAt, timezone)}</TableCell></TableRow>)}</TableBody></Table></div>
          ) : <div className="flex min-h-32 items-center justify-center text-sm text-muted-foreground">لا توجد تغييرات إدارية مسجلة بعد.</div>}
        </CardContent>
      </Card>
    </div>
  )
}
