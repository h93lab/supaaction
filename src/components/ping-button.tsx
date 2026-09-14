"use client"

import { useState } from "react"
import { Play, RefreshCw } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"

export function PingButton({ refs, variant = "default", label = "تنشيط الآن", size = "default" }: { refs?: string[]; variant?: "default" | "outline" | "ghost"; label?: string; size?: "default" | "sm" | "icon" }) {
  const [pending, setPending] = useState(false)
  const router = useRouter()
  return <Button variant={variant} size={size} disabled={pending} onClick={async () => { setPending(true); try { const response = await fetch("/api/projects/ping", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refs }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "تعذر تشغيل التنشيط"); if (data.summary.failed) toast.warning(`اكتمل التنشيط: ${data.summary.succeeded} ناجح و${data.summary.failed} فشل`); else toast.success(`تم تنشيط ${data.summary.succeeded} مشروع بنجاح`); router.refresh() } catch (error) { toast.error(error instanceof Error ? error.message : "تعذر تشغيل التنشيط") } finally { setPending(false) } }} aria-label={label}>{pending ? <RefreshCw className="size-4 animate-spin" /> : <Play className="size-4" />}{size !== "icon" && label}</Button>
}
