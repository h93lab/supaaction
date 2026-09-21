import Link from "next/link"
import { CircleAlert, ShieldAlert, ShieldCheck } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import type { ProjectRecord } from "@/lib/types"

type HealthState = "danger" | "warning" | "healthy"

// Mirrors PAUSED_STATUSES in src/lib/pinger.ts, which decides when a restore is attempted.
const PAUSED_STATUSES = ["INACTIVE", "PAUSED", "PAUSING", "INACTIVE_HEALTHY"]

export function getHealthState(projects: ProjectRecord[], schedulerHeartbeat: string | null, now = Date.now()): { state: HealthState; affected: ProjectRecord[]; schedulerStale: boolean } {
  const danger = projects.filter((project) => PAUSED_STATUSES.includes(project.remoteStatus.toUpperCase()) || project.failStreak >= 3)
  const warning = projects.filter((project) => project.failStreak >= 1 && project.failStreak <= 2)
  const schedulerStale = !schedulerHeartbeat || now - Date.parse(schedulerHeartbeat) > 10 * 60 * 1000
  if (danger.length) return { state: "danger", affected: danger, schedulerStale }
  if (schedulerStale || warning.length) return { state: "warning", affected: schedulerStale ? projects : warning, schedulerStale }
  return { state: "healthy", affected: projects, schedulerStale: false }
}

function projectNames(projects: ProjectRecord[]) {
  const names = projects.slice(0, 3).map((project) => project.name).join("، ")
  const remaining = projects.length - 3
  return remaining > 0 ? `${names} و ${remaining.toLocaleString("ar-EG")} غيرها` : names
}

export function HealthBanner({ projects, schedulerHeartbeat }: { projects: ProjectRecord[]; schedulerHeartbeat: string | null }) {
  const { state, affected, schedulerStale } = getHealthState(projects, schedulerHeartbeat)
  const names = projectNames(affected)
  const config = {
    danger: {
      title: "خطر: توجد مشاريع تحتاج تدخلاً",
      description: `${names} — مشروع متوقف أو تعرّض لثلاثة إخفاقات متتالية على الأقل.`,
      icon: ShieldAlert,
      className: "border-destructive/40 bg-destructive/10 text-destructive",
    },
    warning: {
      title: "تحذير: الحماية تحتاج متابعة",
      description: [schedulerStale ? "لم تصل نبضة المجدول خلال آخر ١٠ دقائق." : "", names ? `المشاريع المتأثرة: ${names}.` : ""].filter(Boolean).join(" "),
      icon: CircleAlert,
      className: "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300",
    },
    healthy: {
      title: "سليم: الحماية تعمل كما ينبغي",
      description: names ? `آخر عمليات التنشيط ناجحة والمجدول متصل: ${names}.` : "المجدول متصل ولا توجد مشكلات مسجلة.",
      icon: ShieldCheck,
      className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
    },
  }[state]
  const Icon = config.icon

  return (
    <Alert className={`mb-6 px-4 py-3 text-right ${config.className}`}>
      <Icon className="size-5" />
      <AlertTitle className="flex items-center justify-between gap-3">
        <span>{config.title}</span>
        <Link href="/projects" className="shrink-0 text-xs">عرض المشاريع</Link>
      </AlertTitle>
      <AlertDescription className="text-current/80">{config.description}</AlertDescription>
    </Alert>
  )
}
