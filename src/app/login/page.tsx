import { redirect } from "next/navigation"
import { Brand } from "@/components/brand"
import { LoginForm } from "@/components/login-form"
import { isAuthenticated } from "@/lib/auth"

export default async function LoginPage() {
  if (await isAuthenticated()) redirect("/dashboard")
  return <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-muted/35 p-4"><div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,color-mix(in_oklch,var(--foreground)_6%,transparent),transparent_36%)]" /><div className="relative w-full max-w-sm"><div className="mb-8 flex justify-center"><Brand /></div><LoginForm /><p className="mt-6 text-center text-xs text-muted-foreground">بياناتك تظل على خادمك المحلي ولا تُرسل إلى أي طرف آخر.</p></div></main>
}
