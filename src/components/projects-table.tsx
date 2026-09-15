"use client"

import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { PingButton } from "@/components/ping-button"
import { StatusBadge } from "@/components/status-badge"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatDate, shortRef } from "@/lib/format"
import type { ProjectRecord } from "@/lib/types"

export function ProjectsTable({ projects, timeZone = "Africa/Cairo", compact = false }: { projects: ProjectRecord[]; timeZone?: string; compact?: boolean }) {
  const router = useRouter()
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

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>المشروع</TableHead><TableHead>الحساب</TableHead><TableHead>الحالة</TableHead>
            <TableHead>آخر تنشيط</TableHead><TableHead>الاستجابة</TableHead>
            {!compact && <TableHead>الحماية</TableHead>}<TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {projects.slice(0, compact ? 6 : undefined).map((project) => (
            <TableRow key={project.ref}>
              <TableCell><div className="font-medium">{project.name}</div><div className="mt-0.5 font-mono text-xs text-muted-foreground" dir="ltr" title={project.ref}>{shortRef(project.ref)}</div></TableCell>
              <TableCell className="text-muted-foreground">{project.accountLabel}</TableCell>
              <TableCell><StatusBadge status={project.lastPingStatus} /></TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(project.lastPingAt, timeZone)}</TableCell>
              <TableCell>{project.lastLatencyMs !== null ? <div className="flex items-center gap-2"><span className="font-mono text-xs">{project.lastLatencyMs}ms</span>{project.lastHttpStatus && <Badge variant="outline" className="font-mono">{project.lastHttpStatus}</Badge>}</div> : "—"}</TableCell>
              {!compact && <TableCell><Switch checked={project.enabled} aria-label={`حماية ${project.name}`} onCheckedChange={(enabled) => void toggleProject(project.ref, enabled)} /></TableCell>}
              <TableCell><PingButton refs={[project.ref]} variant="ghost" size="icon" label={`تنشيط ${project.name}`} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
