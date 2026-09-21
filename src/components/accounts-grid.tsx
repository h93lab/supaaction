"use client"

import { useState } from "react"
import { KeyRound, RefreshCw, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatDate } from "@/lib/format"
import type { AccountDeletionImpact, AccountRecord } from "@/lib/types"

function RotateTokenButton({ account }: { account: AccountRecord }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError("")
    const form = new FormData(event.currentTarget)
    const response = await fetch(`/api/accounts/${account.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: form.get("token") }),
    })
    const data = await response.json()
    if (!response.ok) {
      setError(data.error || "تعذر تحديث التوكن")
      setPending(false)
      return
    }
    toast.success("تم تحديث التوكن مع الاحتفاظ بالمشاريع والسجل")
    setOpen(false)
    setPending(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><KeyRound className="size-3.5" />تحديث التوكن</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>تحديث توكن الحساب</DialogTitle>
          <DialogDescription>استبدل Personal Access Token منتهيًا أو مُدارًا دون حذف الحساب. تبقى المشاريع وسجل التنشيط كما هي.</DialogDescription>
        </DialogHeader>
        <form id="rotate-token-form" className="space-y-4" onSubmit={submit}>
          <div className="space-y-2">
            <Label htmlFor="token">Personal Access Token الجديد</Label>
            <Input id="token" name="token" type="password" dir="ltr" autoComplete="off" placeholder="sbp_..." required />
          </div>
          {error && <p className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">{error}</p>}
        </form>
        <DialogFooter>
          <Button type="submit" form="rotate-token-form" disabled={pending}>{pending ? "جارٍ التحقق..." : "تحقق وحفظ"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DeleteAccountButton({ account }: { account: AccountRecord }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [impact, setImpact] = useState<AccountDeletionImpact | null>(null)
  const [pending, setPending] = useState(false)

  async function loadImpact() {
    setImpact(null)
    try {
      const response = await fetch(`/api/accounts/${account.id}`)
      if (!response.ok) return
      const data = await response.json() as { impact: AccountDeletionImpact }
      setImpact(data.impact)
    } catch {
      setImpact(null)
    }
  }

  async function confirm() {
    setPending(true)
    const response = await fetch(`/api/accounts/${account.id}`, { method: "DELETE" })
    if (response.ok) {
      toast.success("تم حذف الحساب")
      setOpen(false)
      router.refresh()
    } else {
      toast.error("تعذر حذف الحساب")
    }
    setPending(false)
  }

  return (
    <AlertDialog open={open} onOpenChange={(next) => { setOpen(next); if (next) void loadImpact() }}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="حذف الحساب"><Trash2 className="size-4 text-destructive" /></Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>حذف الحساب؟</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>سيتم حذف الحساب من SupaAction فقط. لن يتأثر أي شيء في Supabase.</p>
              {impact === null ? (
                <p className="text-muted-foreground">جارٍ حساب الأثر...</p>
              ) : impact.projects === 0 ? (
                <p>لا توجد مشاريع مرتبطة بهذا الحساب.</p>
              ) : (
                <>
                  <p>{impact.projects.toLocaleString("ar-EG")} مشروع مرتبط بهذا الحساب، و{impact.runs.toLocaleString("ar-EG")} عملية تنشيط مسجلة.</p>
                  {impact.rehomed > 0 && <p>{impact.rehomed.toLocaleString("ar-EG")} مشروع سيُعاد ربطه بحساب آخر يستطيع رؤيته، وسيبقى مفعّلًا بسجله كاملًا.</p>}
                  {impact.orphaned > 0 && <p>{impact.orphaned.toLocaleString("ar-EG")} مشروع لا يراه حساب آخر سيُترك بلا حساب ويُعطَّل، وسيبقى سجله محفوظًا.</p>}
                </>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>إلغاء</AlertDialogCancel>
          <AlertDialogAction disabled={pending} onClick={() => void confirm()}>حذف الحساب</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function AccountsGrid({ accounts }: { accounts: AccountRecord[] }) {
  const router = useRouter()
  const [working, setWorking] = useState<string | null>(null)
  if (!accounts.length) return <Card className="border-dashed"><CardContent className="flex min-h-52 flex-col items-center justify-center text-center"><div className="mb-3 flex size-11 items-center justify-center rounded-full bg-muted"><span className="text-lg">+</span></div><p className="font-medium">لا توجد حسابات متصلة</p><p className="mt-1 max-w-sm text-sm text-muted-foreground">أضف حساب Supabase ليتم اكتشاف مشاريعه وجدولتها تلقائيًا.</p></CardContent></Card>
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {accounts.map((account) => (
        <Card key={account.id}>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">{account.label}</CardTitle>
                <CardDescription className="mt-1 font-mono" dir="ltr">{account.tokenHint}</CardDescription>
              </div>
              <Badge variant={account.status === "connected" ? "secondary" : "destructive"}>{account.status === "connected" ? "متصل" : "خطأ"}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">المشاريع المكتشفة</span><span className="font-medium">{account.projectCount}</span></div>
            <div className="flex justify-between gap-4"><span className="text-muted-foreground">آخر مزامنة</span><span className="text-left">{formatDate(account.lastSyncedAt)}</span></div>
            {account.lastError && <p className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">{account.lastError}</p>}
          </CardContent>
          <CardFooter className="justify-between border-t pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" disabled={working === account.id} onClick={async () => { setWorking(account.id); const response = await fetch(`/api/accounts/${account.id}/sync`, { method: "POST" }); const data = await response.json(); if (response.ok) toast.success(`تمت المزامنة: ${data.projectCount} مشروع`); else toast.error(data.error); setWorking(null); router.refresh() }}><RefreshCw className={`size-3.5 ${working === account.id ? "animate-spin" : ""}`} />مزامنة</Button>
              <RotateTokenButton account={account} />
            </div>
            <DeleteAccountButton account={account} />
          </CardFooter>
        </Card>
      ))}
    </div>
  )
}
