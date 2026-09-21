import Link from "next/link"
import { CircleAlert, ShieldAlert, ShieldCheck } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import type { DashboardData, ProjectRecord } from "@/lib/types"

type HealthState = "danger" | "warning" | "healthy"
type HealthInputs = Pick<DashboardData, "accountErrors" | "schedulerHeartbeat" | "pingSweepHeartbeat" | "lastSuccessfulPingAt"> & {
  projects: ProjectRecord[]
}

// Mirrors PAUSED_STATUSES in src/lib/pinger.ts, which decides when a restore is attempted.
const PAUSED_STATUSES = new Set(["INACTIVE", "PAUSED", "PAUSING", "INACTIVE_HEALTHY"])
const HEARTBEAT_TIMEOUT_MS = 10 * 60 * 1000

function projectNames(projects: ProjectRecord[]) {
  const names = projects.slice(0, 3).map((project) => project.name).join("، ")
  const remaining = projects.length - 3
  return remaining > 0 ? `${names} و ${remaining.toLocaleString("ar-EG")} غيرها` : names
}

function elapsedSince(timestamp: string | null, now: number) {
  if (!timestamp || !Number.isFinite(Date.parse(timestamp))) return "لم يُسجّل أي تنشيط ناجح حتى الآن."
  const elapsed = Math.max(0, now - Date.parse(timestamp))
  const minutes = Math.floor(elapsed / 60_000)
  if (minutes < 1) return "آخر تنشيط ناجح مؤكد: منذ أقل من دقيقة."
  if (minutes < 60) return `آخر تنشيط ناجح مؤكد: منذ ${minutes.toLocaleString("ar-EG")} دقيقة.`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `آخر تنشيط ناجح مؤكد: منذ ${hours.toLocaleString("ar-EG")} ${hours >= 3 && hours <= 10 ? "ساعات" : "ساعة"}.`
  const days = Math.floor(hours / 24)
  return `آخر تنشيط ناجح مؤكد: منذ ${days.toLocaleString("ar-EG")} ${days >= 3 && days <= 10 ? "أيام" : "يوم"}.`
}

export function getHealthState(inputs: HealthInputs, now = Date.now()): { state: HealthState; problems: string[]; lastSuccess: string } {
  const { projects, accountErrors, schedulerHeartbeat, pingSweepHeartbeat, lastSuccessfulPingAt } = inputs
  const enabled = projects.filter((project) => project.enabled && project.accountId !== null)
  const orphaned = projects.filter((project) => project.accountId === null)
  const paused = enabled.filter((project) => PAUSED_STATUSES.has(project.remoteStatus.toUpperCase()))
  const failed = enabled.filter((project) => project.failStreak >= 3)
  const warning = enabled.filter((project) => project.failStreak >= 1 && project.failStreak <= 2)
  const schedulerStale = !schedulerHeartbeat || !Number.isFinite(Date.parse(schedulerHeartbeat)) || now - Date.parse(schedulerHeartbeat) > HEARTBEAT_TIMEOUT_MS
  const sweepStale = pingSweepHeartbeat !== null && (!Number.isFinite(Date.parse(pingSweepHeartbeat)) || now - Date.parse(pingSweepHeartbeat) > HEARTBEAT_TIMEOUT_MS)
  const dangerProblems = [
    ...accountErrors.map((account) => `الحساب «${account.label}»: ${account.message}`),
    ...(sweepStale ? ["توقفت دورة تنشيط المشاريع منذ أكثر من ١٠ دقائق."] : []),
    ...(paused.length ? [`مشاريع متوقفة: ${projectNames(paused)}.`] : []),
    ...(failed.length ? [`مشاريع أخفقت ثلاث مرات متتالية أو أكثر: ${projectNames(failed)}.`] : []),
    ...(orphaned.length ? [`مشاريع بلا حساب مرتبط وتحتاج إلى إعادة ربط: ${projectNames(orphaned)}.`] : []),
  ]
  const warningProblems = [
    ...(schedulerStale ? ["لم تصل نبضة المجدول خلال آخر ١٠ دقائق."] : []),
    ...(warning.length ? [`مشاريع أخفقت مرة أو مرتين: ${projectNames(warning)}.`] : []),
  ]
  const problems = [...dangerProblems, ...warningProblems]
  return {
    state: dangerProblems.length ? "danger" : warningProblems.length ? "warning" : "healthy",
    problems,
    lastSuccess: elapsedSince(lastSuccessfulPingAt, now),
  }
}

export function HealthBanner(inputs: HealthInputs) {
  const { state, problems, lastSuccess } = getHealthState(inputs)
  const config = {
    danger: {
      title: "خطر: الحماية متوقفة أو تحتاج تدخلاً",
      icon: ShieldAlert,
      className: "border-destructive/40 bg-destructive/10 text-destructive",
    },
    warning: {
      title: "تحذير: الحماية تحتاج متابعة",
      icon: CircleAlert,
      className: "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300",
    },
    healthy: {
      title: "سليم: الحماية تعمل كما ينبغي",
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
      <AlertDescription className="text-current/80">
        {problems.length > 0 && <ul className="list-inside list-disc">{problems.map((problem) => <li key={problem}>{problem}</li>)}</ul>}
        <p className={problems.length ? "mt-1" : undefined}>{lastSuccess}</p>
      </AlertDescription>
    </Alert>
  )
}
