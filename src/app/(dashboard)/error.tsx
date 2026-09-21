"use client"

import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center text-center">
      <AlertTriangle className="mb-4 size-10 text-destructive" />
      <h1 className="text-xl font-semibold">تعذر تحميل البيانات</h1>
      <p className="mt-2 text-sm text-muted-foreground">حدث خطأ أثناء الاتصال ببيانات SupaAction. حاول مرة أخرى.</p>
      <Button className="mt-5" onClick={reset}>إعادة المحاولة</Button>
    </div>
  )
}
