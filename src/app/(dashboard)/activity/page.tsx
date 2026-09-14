import { PageHeading } from "@/components/page-heading"
import { StatusBadge } from "@/components/status-badge"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getSettings, listRecentRuns } from "@/lib/db"
import { formatDate, shortRef } from "@/lib/format"

export const dynamic = "force-dynamic"

export default function ActivityPage() {
  const runs = listRecentRuns(250)
  const { timezone } = getSettings()
  return <div className="mx-auto max-w-[1500px]"><PageHeading title="سجل النشاط" description="تفاصيل محاولات التنشيط اليدوية والمجدولة ونتائج إعادة المحاولة." /><Card className="overflow-hidden"><CardContent className="p-0">{runs.length ? <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>المشروع</TableHead><TableHead>وقت التنفيذ</TableHead><TableHead>المصدر</TableHead><TableHead>النتيجة</TableHead><TableHead>HTTP</TableHead><TableHead>الزمن</TableHead><TableHead>المحاولات</TableHead><TableHead>التفاصيل</TableHead></TableRow></TableHeader><TableBody>{runs.map((run) => <TableRow key={run.id}><TableCell><div className="font-medium">{run.projectName}</div><div className="font-mono text-xs text-muted-foreground" dir="ltr">{shortRef(run.projectRef)}</div></TableCell><TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(run.completedAt, timezone)}</TableCell><TableCell><Badge variant="outline">{run.trigger === "manual" ? "يدوي" : "مجدول"}</Badge></TableCell><TableCell><StatusBadge status={run.status} /></TableCell><TableCell className="font-mono text-xs">{run.httpStatus ?? "—"}</TableCell><TableCell className="font-mono text-xs">{run.latencyMs ?? 0}ms</TableCell><TableCell>{run.attemptCount}</TableCell><TableCell className="max-w-xs truncate text-xs text-muted-foreground" title={run.error ?? "تم تنفيذ select 1 بنجاح"}>{run.error ?? "select 1"}</TableCell></TableRow>)}</TableBody></Table></div> : <div className="flex min-h-60 flex-col items-center justify-center text-center"><p className="font-medium">سجل النشاط فارغ</p><p className="mt-1 text-sm text-muted-foreground">ستظهر نتائج التنشيط هنا بعد أول تشغيل.</p></div>}</CardContent></Card></div>
}
