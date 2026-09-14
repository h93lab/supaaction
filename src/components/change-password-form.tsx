"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { KeyRound } from "lucide-react"
import { toast } from "sonner"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function ChangePasswordForm() {
  const router = useRouter()
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    if (newPassword.length < 12) {
      setError("كلمة المرور الجديدة يجب ألا تقل عن 12 حرفًا")
      return
    }
    if (newPassword !== confirmation) {
      setError("تأكيد كلمة المرور غير مطابق")
      return
    }

    setPending(true)
    try {
      const response = await fetch("/api/auth/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const data = await response.json().catch(() => ({})) as { error?: string }
      if (!response.ok) {
        setError(data.error || "تعذر تغيير كلمة المرور")
        return
      }
      toast.success("تم تغيير كلمة المرور. سجل الدخول من جديد")
      router.replace("/login")
      router.refresh()
    } catch {
      setError("تعذر الاتصال بالخادم. حاول مرة أخرى")
    } finally {
      setPending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><KeyRound className="size-4" />أمان الحساب</CardTitle>
        <CardDescription>غيّر كلمة مرور لوحة التحكم وألغِ الجلسات القديمة.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-2">
            <Label htmlFor="current-password">كلمة المرور الحالية</Label>
            <Input id="current-password" type="password" autoComplete="current-password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">كلمة المرور الجديدة</Label>
            <Input id="new-password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">تأكيد كلمة المرور</Label>
            <Input id="confirm-password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
          </div>
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          <Button type="submit" variant="outline" className="w-full" disabled={pending}>
            {pending ? "جارٍ التغيير..." : "تغيير كلمة المرور"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
