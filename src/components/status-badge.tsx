import { Badge } from "@/components/ui/badge"

export function StatusBadge({ status }: { status: string | null }) {
  if (status === "success") return <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">ناجح</Badge>
  if (status === "failed") return <Badge variant="destructive">فشل</Badge>
  if (status === "pending") return <Badge variant="secondary">قيد التشغيل</Badge>
  return <Badge variant="outline">لم يعمل</Badge>
}
