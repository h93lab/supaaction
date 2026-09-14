"use client"

import { useState } from "react"
import { Save } from "lucide-react"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import type { AppSettings } from "@/lib/types"

export function SettingsForm({ initial }: { initial: AppSettings }) {
  const [settings, setSettings] = useState(initial)
  const [pending, setPending] = useState(false)
  const numberField = (key: keyof AppSettings) => (event: React.ChangeEvent<HTMLInputElement>) => setSettings((current) => ({ ...current, [key]: Number(event.target.value) }))
  return <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]"><Card><CardHeader><CardTitle>جدولة التنشيط</CardTitle><CardDescription>المجدول يفحص المشاريع المستحقة كل دقيقة، ولا يرسل الطلب إلا بعد مرور المدة المحددة.</CardDescription></CardHeader><CardContent><form className="space-y-6" onSubmit={async (event) => { event.preventDefault(); setPending(true); const response = await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) }); const data = await response.json(); if (response.ok) { setSettings(data); toast.success("تم حفظ الإعدادات") } else toast.error(data.error || "تعذر حفظ الإعدادات"); setPending(false) }}><div className="grid gap-4 sm:grid-cols-2"><Field label="الفاصل بين كل تنشيط (ساعة)" hint="72 ساعة = 3 أيام"><Input type="number" min={1} max={168} value={settings.pingIntervalHours} onChange={numberField("pingIntervalHours")} /></Field><Field label="مهلة الطلب (ثانية)" hint="قبل اعتباره timeout"><Input type="number" min={5} max={120} value={settings.requestTimeoutSeconds} onChange={numberField("requestTimeoutSeconds")} /></Field><Field label="عدد إعادات المحاولة" hint="بعد المحاولة الأولى"><Input type="number" min={0} max={5} value={settings.retryCount} onChange={numberField("retryCount")} /></Field><Field label="تأخير إعادة المحاولة (ثانية)" hint="يزداد تدريجيًا"><Input type="number" min={1} max={60} value={settings.retryDelaySeconds} onChange={numberField("retryDelaySeconds")} /></Field><Field label="عدد الطلبات المتوازية" hint="من 1 إلى 10"><Input type="number" min={1} max={10} value={settings.concurrency} onChange={numberField("concurrency")} /></Field><Field label="المنطقة الزمنية" hint="تستخدم لعرض الأوقات"><Input dir="ltr" value={settings.timezone} onChange={(event) => setSettings((current) => ({ ...current, timezone: event.target.value }))} /></Field></div><div className="flex items-center justify-between rounded-lg border p-4"><div><Label htmlFor="auto-sync" className="text-sm font-medium">المزامنة التلقائية للحسابات</Label><p className="mt-1 text-xs text-muted-foreground">اكتشاف المشاريع الجديدة كل {settings.syncIntervalHours} ساعة</p></div><Switch id="auto-sync" checked={settings.autoSync} onCheckedChange={(autoSync) => setSettings((current) => ({ ...current, autoSync }))} /></div>{settings.autoSync && <Field label="فاصل المزامنة (ساعة)" hint="الحد الافتراضي 24 ساعة"><Input className="max-w-xs" type="number" min={1} max={168} value={settings.syncIntervalHours} onChange={numberField("syncIntervalHours")} /></Field>}<Button type="submit" disabled={pending}><Save className="size-4" />{pending ? "جارٍ الحفظ..." : "حفظ الإعدادات"}</Button></form></CardContent></Card><div className="space-y-4"><Alert><AlertTitle>كيف يعمل التنشيط؟</AlertTitle><AlertDescription>ينفذ SupaAction استعلام <code dir="ltr" className="rounded bg-muted px-1 font-mono">select 1</code> عبر Supabase Management API. لا يقرأ أي جدول أو بيانات مستخدم.</AlertDescription></Alert><Card><CardHeader><CardTitle className="text-base">الإعداد الموصى به</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><InfoRow label="الفاصل" value="72 ساعة" /><InfoRow label="Retries" value="2" /><InfoRow label="Timeout" value="20 ثانية" /><InfoRow label="Concurrency" value="3" /></CardContent></Card></div></div>
}

function Field({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}<p className="text-xs text-muted-foreground">{hint}</p></div>
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between"><span className="text-muted-foreground">{label}</span><span className="font-mono text-xs">{value}</span></div>
}
