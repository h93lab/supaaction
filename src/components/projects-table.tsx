"use client"

import { useState } from "react"
import { History, RotateCcw } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { PingButton } from "@/components/ping-button"
import { RemoteStatusBadge, StatusBadge } from "@/components/status-badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { formatDate, formatRelativeTime, shortRef } from "@/lib/format"
import type { PingRunRecord, ProjectRecord } from "@/lib/types"

function RestoreIndicator({ project, timeZone }: { project: ProjectRecord; timeZone: string }) {
  if (!project.restoreCount) return null
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2 py-0.5 text-xs text-sky-700 dark:text-sky-300" aria-label={`تمت الاستعادة ${project.restoreCount} مرة`}>
          <RotateCcw className="size-3" />{project.restoreCount.toLocaleString("ar-EG")}
        </span>
      </TooltipTrigger>
      <TooltipContent>آخر استعادة: {formatDate(project.lastRestoreAt, timeZone)}</TooltipContent>
    </Tooltip>
  )
}

function FailureCount({ count }: { count: number }) {
  return count > 0 ? <span className="text-xs font-medium text-amber-700 dark:text-amber-300">{count.toLocaleString("ar-EG")} إخفاق متتالٍ</span> : null
}

export function ProjectsTable({ projects, timeZone = "Africa/Cairo", compact = false }: { projects: ProjectRecord[]; timeZone?: string; compact?: boolean }) {
  const router = useRouter()
  const [selected, setSelected] = useState<ProjectRecord | null>(null)
  const [runs, setRuns] = useState<PingRunRecord[] | null>(null)
  const [runsError, setRunsError] = useState("")
  const shownProjects = projects.slice(0, compact ? 6 : undefined)

  if (!projects.length) {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center text-center">
        <p className="font-medium">{compact ? "لا توجد مشاريع بعد" : "لا توجد مشاريع مطابقة"}</p>
        <p className="mt-1 text-sm text-muted-foreground">{compact ? "اربط حساب Supabase لتظهر المشاريع هنا تلقائيًا." : "جرّب تغيير البحث أو اربط حساب Supabase جديدًا."}</p>
      </div>
    )
  }

  async function toggleProject(ref: string, enabled: boolean) {
    try {
      const response = await fetch(`/api/projects/${ref}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      })
      if (!response.ok) throw new Error()
      toast.success(enabled ? "تم تفعيل الحماية" : "تم إيقاف الحماية")
      router.refresh()
    } catch {
      toast.error("تعذر تحديث المشروع")
    }
  }

  async function openProject(project: ProjectRecord) {
    setSelected(project)
    setRuns(null)
    setRunsError("")
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(project.ref)}/runs`)
      if (!response.ok) throw new Error()
      const data = await response.json() as { runs: PingRunRecord[] }
      setRuns(data.runs)
    } catch {
      setRunsError("تعذر تحميل سجل التنشيط. حاول مرة أخرى.")
    }
  }

  function rowKeyDown(event: React.KeyboardEvent, project: ProjectRecord) {
    if (event.target !== event.currentTarget) return
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      void openProject(project)
    }
  }

  return (
    <TooltipProvider>
      <div className="md:hidden">
        {shownProjects.map((project) => (
          <article key={project.ref} role="button" tabIndex={0} onClick={() => void openProject(project)} onKeyDown={(event) => rowKeyDown(event, project)} className={`border-b p-4 transition-colors last:border-b-0 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${project.enabled ? "" : "opacity-50"}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><h3 className="truncate font-medium">{project.name}</h3><p className="mt-0.5 text-xs text-muted-foreground">{project.accountLabel} · <span className="font-mono" dir="ltr">{shortRef(project.ref)}</span></p></div>
              <div className="flex shrink-0 flex-wrap justify-end gap-1"><RemoteStatusBadge status={project.remoteStatus} /><StatusBadge status={project.lastPingStatus} /></div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-xs text-muted-foreground">التنشيط القادم</p><p className="mt-0.5">{formatRelativeTime(project.nextPingAt)}</p></div>
              <div><p className="text-xs text-muted-foreground">آخر استجابة</p><p className="mt-0.5 font-mono text-xs" dir="ltr">{project.lastLatencyMs !== null ? `${project.lastLatencyMs}ms · ${project.lastHttpStatus ?? "—"}` : "—"}</p></div>
            </div>
            <div className="mt-3 flex items-center gap-2"><FailureCount count={project.failStreak} /><RestoreIndicator project={project} timeZone={timeZone} /><span className="me-auto" />{!compact && <span onClick={(event) => event.stopPropagation()}><Switch checked={project.enabled} aria-label={`حماية ${project.name}`} onCheckedChange={(enabled) => void toggleProject(project.ref, enabled)} /></span>}<span onClick={(event) => event.stopPropagation()}><PingButton refs={[project.ref]} variant="ghost" size="icon" label={`تنشيط ${project.name}`} /></span></div>
          </article>
        ))}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <Table>
          <TableHeader><TableRow><TableHead>المشروع</TableHead><TableHead>حالة Supabase</TableHead><TableHead>آخر تنشيط</TableHead><TableHead>التنشيط القادم</TableHead><TableHead>الاستجابة</TableHead>{!compact && <TableHead>الحماية</TableHead>}<TableHead className="w-12" /></TableRow></TableHeader>
          <TableBody>{shownProjects.map((project) => (
            <TableRow key={project.ref} role="button" tabIndex={0} onClick={() => void openProject(project)} onKeyDown={(event) => rowKeyDown(event, project)} className={`cursor-pointer ${project.enabled ? "" : "opacity-50"}`}>
              <TableCell><div className="flex items-center gap-2"><div><div className="font-medium">{project.name}</div><div className="mt-0.5 text-xs text-muted-foreground">{project.accountLabel} · <span className="font-mono" dir="ltr" title={project.ref}>{shortRef(project.ref)}</span></div></div><RestoreIndicator project={project} timeZone={timeZone} /></div></TableCell>
              <TableCell><RemoteStatusBadge status={project.remoteStatus} /></TableCell>
              <TableCell><div className="space-y-1"><StatusBadge status={project.lastPingStatus} /><FailureCount count={project.failStreak} /><p className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(project.lastPingAt, timeZone)}</p></div></TableCell>
              <TableCell className="whitespace-nowrap">{formatRelativeTime(project.nextPingAt)}</TableCell>
              <TableCell>{project.lastLatencyMs !== null ? <div className="flex items-center gap-2"><span className="font-mono text-xs">{project.lastLatencyMs}ms</span>{project.lastHttpStatus && <Badge variant="outline" className="font-mono">{project.lastHttpStatus}</Badge>}</div> : "—"}</TableCell>
              {!compact && <TableCell onClick={(event) => event.stopPropagation()}><Switch checked={project.enabled} aria-label={`حماية ${project.name}`} onCheckedChange={(enabled) => void toggleProject(project.ref, enabled)} /></TableCell>}
              <TableCell onClick={(event) => event.stopPropagation()}><PingButton refs={[project.ref]} variant="ghost" size="icon" label={`تنشيط ${project.name}`} /></TableCell>
            </TableRow>
          ))}</TableBody>
        </Table>
      </div>

      <Sheet open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null) }}>
        <SheetContent side="left" className="w-full overflow-y-auto sm:max-w-xl" dir="rtl">
          {selected && <>
            <SheetHeader className="border-b text-right">
              <SheetTitle>{selected.name}</SheetTitle>
              <SheetDescription><span className="font-mono" dir="ltr">{selected.ref}</span></SheetDescription>
              <div className="grid grid-cols-2 gap-2 pt-3 text-xs text-muted-foreground sm:grid-cols-3"><span>الحساب: {selected.accountLabel}</span><span>المنطقة: {selected.region || "غير معروفة"}</span><span>المؤسسة: {selected.organizationSlug || selected.organizationId || "غير معروفة"}</span></div>
            </SheetHeader>
            <div className="space-y-3 px-4 pb-6">
              <div className="flex items-center gap-2"><History className="size-4" /><h3 className="font-medium">آخر ٢٠ عملية تنشيط</h3></div>
              {runsError ? <Alert variant="destructive"><AlertDescription>{runsError}</AlertDescription><Button size="sm" variant="outline" className="mt-2" onClick={() => void openProject(selected)}>إعادة المحاولة</Button></Alert> : runs === null ? <p className="py-12 text-center text-sm text-muted-foreground">جارٍ تحميل السجل...</p> : runs.length ? runs.map((run) => (
                <div key={run.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-3"><StatusBadge status={run.status} /><span className="text-xs text-muted-foreground">{formatDate(run.completedAt || run.startedAt, timeZone)}</span></div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs"><div><span className="text-muted-foreground">الزمن</span><p className="mt-0.5 font-mono" dir="ltr">{run.latencyMs !== null ? `${run.latencyMs}ms` : "—"}</p></div><div><span className="text-muted-foreground">HTTP</span><p className="mt-0.5 font-mono">{run.httpStatus ?? "—"}</p></div><div><span className="text-muted-foreground">المحاولات</span><p className="mt-0.5">{run.attemptCount.toLocaleString("ar-EG")}</p></div></div>
                  {run.error && <p className="mt-3 rounded-md bg-destructive/10 p-2 text-xs text-destructive" dir="auto">{run.error}</p>}
                </div>
              )) : <p className="py-12 text-center text-sm text-muted-foreground">لا توجد عمليات تنشيط لهذا المشروع بعد.</p>}
            </div>
          </>}
        </SheetContent>
      </Sheet>
    </TooltipProvider>
  )
}
