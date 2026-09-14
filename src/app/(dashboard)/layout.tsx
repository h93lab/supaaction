import { redirect } from "next/navigation"
import { AppHeader } from "@/components/app-header"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { isAuthenticated } from "@/lib/auth"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAuthenticated())) redirect("/login")
  return <SidebarProvider defaultOpen><AppSidebar /><SidebarInset className="min-w-0"><AppHeader /><main className="flex-1 bg-muted/25 p-4 lg:p-6">{children}</main></SidebarInset></SidebarProvider>
}
