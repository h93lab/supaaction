"use client"

import { useState } from "react"
import { LockKeyhole } from "lucide-react"
import { useRouter } from "next/navigation"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function LoginForm() {
  const router = useRouter()
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)
  return <Card><CardHeader className="text-center"><div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-full bg-muted"><LockKeyhole className="size-5" /></div><CardTitle>الدخول إلى المنصة</CardTitle><CardDescription>أدخل كلمة مرور الإدارة التي ضبطتها في Docker</CardDescription></CardHeader><CardContent><form className="space-y-4" onSubmit={async (event) => { event.preventDefault(); setPending(true); setError(""); const password = new FormData(event.currentTarget).get("password"); const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) }); const data = await response.json(); if (!response.ok) { setError(data.error || "تعذر تسجيل الدخول"); setPending(false); return } router.replace("/dashboard"); router.refresh() }}><div className="space-y-2"><Label htmlFor="password">كلمة المرور</Label><Input id="password" name="password" type="password" autoComplete="current-password" required autoFocus placeholder="••••••••••••" /></div>{error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}<Button className="w-full" size="lg" disabled={pending}>{pending ? "جارٍ التحقق..." : "تسجيل الدخول"}</Button></form></CardContent></Card>
}
