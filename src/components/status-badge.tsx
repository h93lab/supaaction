import { Badge } from "@/components/ui/badge"

export function StatusBadge({ status }: { status: string | null }) {
  if (status === "success") return <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">ناجح</Badge>
  if (status === "failed") return <Badge variant="destructive">فشل</Badge>
  if (status === "pending") return <Badge variant="secondary">قيد التشغيل</Badge>
  return <Badge variant="outline">لم يعمل</Badge>
}

const remoteStatusLabels: Record<string, string> = {
  ACTIVE_HEALTHY: "نشط",
  INACTIVE: "متوقف",
  PAUSED: "متوقف",
  PAUSING: "قيد الإيقاف",
  UNKNOWN: "غير معروف",
}

export function RemoteStatusBadge({ status }: { status: string }) {
  const normalized = status.toUpperCase()
  if (normalized === "ACTIVE_HEALTHY") return <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">{remoteStatusLabels[normalized]}</Badge>
  if (normalized === "INACTIVE" || normalized === "PAUSED") return <Badge variant="destructive">{remoteStatusLabels[normalized]}</Badge>
  if (normalized === "PAUSING") return <Badge className="border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-50 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">{remoteStatusLabels[normalized]}</Badge>
  return <Badge variant="outline" title={status}>{remoteStatusLabels[normalized] || remoteStatusLabels.UNKNOWN}</Badge>
}
