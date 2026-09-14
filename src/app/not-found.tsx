import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return <main className="flex min-h-screen items-center justify-center p-6 text-center"><div><p className="font-mono text-sm text-muted-foreground">404</p><h1 className="mt-2 text-2xl font-semibold">الصفحة غير موجودة</h1><Button className="mt-5" asChild><Link href="/dashboard">العودة للوحة التحكم</Link></Button></div></main>
}
