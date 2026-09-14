"use client"

import { useEffect } from "react"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error) }, [error])
  return <div className="flex min-h-screen items-center justify-center p-6"><div className="max-w-md text-center"><AlertTriangle className="mx-auto mb-4 size-10 text-destructive" /><h1 className="text-xl font-semibold">حدث خطأ غير متوقع</h1><p className="mt-2 text-sm text-muted-foreground">تحقق من إعدادات Docker وسجل التشغيل، ثم حاول مرة أخرى.</p><Button className="mt-5" onClick={reset}>إعادة المحاولة</Button></div></div>
}
