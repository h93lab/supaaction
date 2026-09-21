"use client"

import { KeyRound, PanelRight } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LogoutButton } from "@/components/logout-button"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useSidebar } from "@/components/ui/sidebar"

const titles: Record<string, string> = { "/dashboard": "نظرة عامة", "/projects": "المشاريع", "/accounts": "الحسابات", "/activity": "سجل النشاط", "/settings": "الإعدادات" }

export function AppHeader() {
  const { toggleSidebar } = useSidebar()
  const pathname = usePathname()
  return <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"><div className="flex h-14 items-center justify-between px-4 lg:px-6"><div className="flex items-center gap-3"><Button variant="ghost" size="icon" onClick={toggleSidebar} aria-label="فتح القائمة"><PanelRight className="size-5" /></Button><Separator orientation="vertical" className="h-4" /><div><p className="text-sm font-medium">{titles[pathname] ?? "SupaAction"}</p><p className="hidden text-xs text-muted-foreground sm:block">إدارة نشاط مشاريع Supabase من مكان واحد</p></div></div><div className="flex items-center gap-1"><Button variant="ghost" size="icon" aria-label="تغيير كلمة المرور" title="تغيير كلمة المرور" asChild><Link href="/settings?tab=security"><KeyRound className="size-4" /></Link></Button><ThemeToggle /><LogoutButton /></div></div></header>
}
