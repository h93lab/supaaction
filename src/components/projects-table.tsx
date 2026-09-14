"use client"

import { useMemo, useState } from "react"
import { Search } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { PingButton } from "@/components/ping-button"
import { StatusBadge } from "@/components/status-badge"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatDate, shortRef } from "@/lib/format"
import type { ProjectRecord } from "@/lib/types"

export function ProjectsTable({ projects, timeZone = "Africa/Cairo", compact = false }: { projects: ProjectRecord[]; timeZone?: string; compact?: boolean }) {
  const [search, setSearch] = useState("")
  const router = useRouter()
  const filtered = useMemo(() => projects.filter((project) => `${project.name} ${project.ref} ${project.accountLabel}`.toLowerCase().includes(search.toLowerCase())), [projects, search])
  if (!projects.length) return <div className="flex min-h-48 flex-col items-center justify-center text-center"><p className="font-medium">لا توجد مشاريع بعد</p><p className="mt-1 text-sm text-muted-foreground">اربط حساب Supabase لتظهر المشاريع هنا تلقائيًا.</p></div>
  return <div><div className={`flex items-center justify-between gap-3 border-b p-3 ${compact ? "hidden" : ""}`}><div className="relative w-full max-w-sm"><Search className="absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} className="pr-9" placeholder="ابحث بالاسم أو المعرّف..." /></div><span className="shrink-0 text-xs text-muted-foreground">{filtered.length} مشروع</span></div><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>المشروع</TableHead><TableHead>الحساب</TableHead><TableHead>الحالة</TableHead><TableHead>آخر تنشيط</TableHead><TableHead>الاستجابة</TableHead>{!compact && <TableHead>الحماية</TableHead>}<TableHead className="w-12" /></TableRow></TableHeader><TableBody>{filtered.slice(0, compact ? 6 : undefined).map((project) => <TableRow key={project.ref}><TableCell><div className="font-medium">{project.name}</div><div className="mt-0.5 font-mono text-xs text-muted-foreground" dir="ltr" title={project.ref}>{shortRef(project.ref)}</div></TableCell><TableCell className="text-muted-foreground">{project.accountLabel}</TableCell><TableCell><StatusBadge status={project.lastPingStatus} /></TableCell><TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(project.lastPingAt, timeZone)}</TableCell><TableCell>{project.lastLatencyMs !== null ? <div className="flex items-center gap-2"><span className="font-mono text-xs">{project.lastLatencyMs}ms</span>{project.lastHttpStatus && <Badge variant="outline" className="font-mono">{project.lastHttpStatus}</Badge>}</div> : "—"}</TableCell>{!compact && <TableCell><Switch checked={project.enabled} aria-label={`حماية ${project.name}`} onCheckedChange={async (enabled) => { const response = await fetch(`/api/projects/${project.ref}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled }) }); if (!response.ok) toast.error("تعذر تحديث المشروع"); else { toast.success(enabled ? "تم تفعيل الحماية" : "تم إيقاف الحماية"); router.refresh() } }} /></TableCell>}<TableCell><PingButton refs={[project.ref]} variant="ghost" size="icon" label={`تنشيط ${project.name}`} /></TableCell></TableRow>)}</TableBody></Table></div></div>
}
