"use client"

import { LogOut } from "lucide-react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

export function LogoutButton() {
  const router = useRouter()
  return <Button variant="ghost" size="icon" aria-label="تسجيل الخروج" onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); router.replace("/login"); router.refresh() }}><LogOut className="size-4" /></Button>
}
