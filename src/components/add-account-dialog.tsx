"use client"

import { useState } from "react"
import { ExternalLink, Plus, ShieldCheck } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function AddAccountDialog() {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button><Plus className="size-4" />إضافة حساب</Button></DialogTrigger><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>ربط حساب Supabase</DialogTitle><DialogDescription>أضف Personal Access Token مرة واحدة، وسنكتشف كل المشاريع المتاحة له تلقائيًا.</DialogDescription></DialogHeader><form id="add-account-form" className="space-y-4" onSubmit={async (event) => { event.preventDefault(); setPending(true); setError(""); const form = new FormData(event.currentTarget); const response = await fetch("/api/accounts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label: form.get("label"), token: form.get("token") }) }); const data = await response.json(); if (!response.ok) { setError(data.error || "تعذر إضافة الحساب"); setPending(false); return } toast.success(`تم ربط الحساب واكتشاف ${data.projectCount} مشروع`); setOpen(false); router.refresh(); setPending(false) }}><div className="space-y-2"><Label htmlFor="label">اسم تعريفي</Label><Input id="label" name="label" placeholder="حساب المشاريع الشخصية" required /></div><div className="space-y-2"><div className="flex items-center justify-between"><Label htmlFor="token">Personal Access Token</Label><a href="https://supabase.com/dashboard/account/tokens" target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">إنشاء توكن<ExternalLink className="size-3" /></a></div><Input id="token" name="token" type="password" dir="ltr" autoComplete="off" placeholder="sbp_..." required /></div><Alert><ShieldCheck className="size-4" /><AlertTitle>أقل صلاحيات مطلوبة</AlertTitle><AlertDescription>قراءة المشاريع وقواعد البيانات. التوكن يُشفّر بـ AES-256-GCM قبل تخزينه ولن يظهر مجددًا.</AlertDescription></Alert>{error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}</form><DialogFooter><Button type="submit" form="add-account-form" disabled={pending}>{pending ? "جارٍ الاتصال..." : "ربط واكتشاف المشاريع"}</Button></DialogFooter></DialogContent></Dialog>
}
