"use client"

import { useState } from "react"
import { KeyRound, Save } from "lucide-react"
import { toast } from "sonner"
import { ChangePasswordForm } from "@/components/change-password-form"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { AppSettings } from "@/lib/types"

export function SettingsForm({ initial, initialTab = "schedule" }: { initial: AppSettings; initialTab?: "schedule" | "security" }) {
  const [settings, setSettings] = useState(initial)
  const [pending, setPending] = useState(false)

  const updateNumber = (key: keyof AppSettings) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setSettings((current) => ({ ...current, [key]: Number(event.target.value) }))
  }

  async function saveSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      })
      const data = await response.json().catch(() => ({})) as AppSettings & { error?: string }
      if (!response.ok) throw new Error(data.error || "تعذر حفظ الإعدادات")
      setSettings(data)
      toast.success("تم حفظ الإعدادات")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر حفظ الإعدادات")
    } finally {
      setPending(false)
    }
  }

  return (
    <Tabs defaultValue={initialTab} className="space-y-6">
      <TabsList aria-label="أقسام الإعدادات">
        <TabsTrigger value="schedule">الجدولة</TabsTrigger>
        <TabsTrigger value="security"><KeyRound className="size-4" />كلمة المرور والأمان</TabsTrigger>
      </TabsList>

      <TabsContent value="schedule">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Card>
            <CardHeader><CardTitle>جدولة التنشيط</CardTitle><CardDescription>المجدول يفحص المشاريع المستحقة كل دقيقة، ولا يرسل الطلب إلا بعد مرور المدة المحددة.</CardDescription></CardHeader>
            <CardContent>
              <form className="space-y-6" onSubmit={saveSettings}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field id="ping-interval" label="الفاصل بين كل تنشيط (ساعة)" hint="72 ساعة = 3 أيام"><Input id="ping-interval" type="number" min={1} max={168} value={settings.pingIntervalHours} onChange={updateNumber("pingIntervalHours")} /></Field>
                  <Field id="request-timeout" label="مهلة الطلب (ثانية)" hint="قبل اعتباره timeout"><Input id="request-timeout" type="number" min={5} max={120} value={settings.requestTimeoutSeconds} onChange={updateNumber("requestTimeoutSeconds")} /></Field>
                  <Field id="retry-count" label="عدد إعادات المحاولة" hint="بعد المحاولة الأولى"><Input id="retry-count" type="number" min={0} max={5} value={settings.retryCount} onChange={updateNumber("retryCount")} /></Field>
                  <Field id="retry-delay" label="تأخير إعادة المحاولة (ثانية)" hint="يزداد تدريجيًا"><Input id="retry-delay" type="number" min={1} max={60} value={settings.retryDelaySeconds} onChange={updateNumber("retryDelaySeconds")} /></Field>
                  <Field id="concurrency" label="عدد الطلبات المتوازية" hint="من 1 إلى 10"><Input id="concurrency" type="number" min={1} max={10} value={settings.concurrency} onChange={updateNumber("concurrency")} /></Field>
                  <Field id="timezone" label="المنطقة الزمنية" hint="تستخدم لعرض الأوقات"><Input id="timezone" dir="ltr" value={settings.timezone} onChange={(event) => setSettings((current) => ({ ...current, timezone: event.target.value }))} /></Field>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div><Label htmlFor="auto-sync" className="text-sm font-medium">المزامنة التلقائية للحسابات</Label><p className="mt-1 text-xs text-muted-foreground">اكتشاف المشاريع الجديدة كل {settings.syncIntervalHours} ساعة</p></div>
                  <Switch id="auto-sync" checked={settings.autoSync} onCheckedChange={(autoSync) => setSettings((current) => ({ ...current, autoSync }))} />
                </div>
                {settings.autoSync && <Field id="sync-interval" label="فاصل المزامنة (ساعة)" hint="الحد الافتراضي 24 ساعة"><Input id="sync-interval" className="max-w-xs" type="number" min={1} max={168} value={settings.syncIntervalHours} onChange={updateNumber("syncIntervalHours")} /></Field>}
                <Button type="submit" disabled={pending}><Save className="size-4" />{pending ? "جارٍ الحفظ..." : "حفظ الإعدادات"}</Button>
              </form>
            </CardContent>
          </Card>
          <div className="space-y-4">
            <Alert><AlertTitle>كيف يعمل التنشيط؟</AlertTitle><AlertDescription>ينفذ SupaAction استعلام <code dir="ltr" className="rounded bg-muted px-1 font-mono">select 1</code> عبر Supabase Management API. لا يقرأ أي جدول أو بيانات مستخدم.</AlertDescription></Alert>
            <Card><CardHeader><CardTitle className="text-base">الإعداد الموصى به</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><InfoRow label="الفاصل" value="72 ساعة" /><InfoRow label="Retries" value="2" /><InfoRow label="Timeout" value="20 ثانية" /><InfoRow label="Concurrency" value="3" /></CardContent></Card>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="security" className="max-w-xl"><ChangePasswordForm /></TabsContent>
    </Tabs>
  )
}

function Field({ id, label, hint, children }: { id: string; label: string; hint: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label>{children}<p id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}</p></div>
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between"><span className="text-muted-foreground">{label}</span><span className="font-mono text-xs">{value}</span></div>
}
