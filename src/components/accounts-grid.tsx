"use client"

import { useState } from "react"
import { RefreshCw, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDate } from "@/lib/format"
import type { AccountRecord } from "@/lib/types"

export function AccountsGrid({ accounts }: { accounts: AccountRecord[] }) {
  const router = useRouter()
  const [working, setWorking] = useState<string | null>(null)
  if (!accounts.length) return <Card className="border-dashed"><CardContent className="flex min-h-52 flex-col items-center justify-center text-center"><div className="mb-3 flex size-11 items-center justify-center rounded-full bg-muted"><span className="text-lg">+</span></div><p className="font-medium">لا توجد حسابات متصلة</p><p className="mt-1 max-w-sm text-sm text-muted-foreground">أضف حساب Supabase ليتم اكتشاف مشاريعه وجدولتها تلقائيًا.</p></CardContent></Card>
  return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{accounts.map((account) => <Card key={account.id}><CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle className="text-base">{account.label}</CardTitle><CardDescription className="mt-1 font-mono" dir="ltr">{account.tokenHint}</CardDescription></div><Badge variant={account.status === "connected" ? "secondary" : "destructive"}>{account.status === "connected" ? "متصل" : "خطأ"}</Badge></div></CardHeader><CardContent className="space-y-3 text-sm"><div className="flex justify-between"><span className="text-muted-foreground">المشاريع المكتشفة</span><span className="font-medium">{account.projectCount}</span></div><div className="flex justify-between gap-4"><span className="text-muted-foreground">آخر مزامنة</span><span className="text-left">{formatDate(account.lastSyncedAt)}</span></div>{account.lastError && <p className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">{account.lastError}</p>}</CardContent><CardFooter className="justify-between border-t pt-4"><Button variant="outline" size="sm" disabled={working === account.id} onClick={async () => { setWorking(account.id); const response = await fetch(`/api/accounts/${account.id}/sync`, { method: "POST" }); const data = await response.json(); if (response.ok) toast.success(`تمت المزامنة: ${data.projectCount} مشروع`); else toast.error(data.error); setWorking(null); router.refresh() }}><RefreshCw className={`size-3.5 ${working === account.id ? "animate-spin" : ""}`} />مزامنة</Button><AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" size="icon" aria-label="حذف الحساب"><Trash2 className="size-4 text-destructive" /></Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>حذف الحساب؟</AlertDialogTitle><AlertDialogDescription>سيتم حذف بيانات الحساب وسجل كل مشاريعه من SupaAction فقط. لن يتم حذف أي شيء من Supabase.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>إلغاء</AlertDialogCancel><AlertDialogAction onClick={async () => { const response = await fetch(`/api/accounts/${account.id}`, { method: "DELETE" }); if (response.ok) { toast.success("تم حذف الحساب"); router.refresh() } else toast.error("تعذر حذف الحساب") }}>حذف الحساب</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></CardFooter></Card>)}</div>
}
