"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Activity, FolderKanban, LayoutDashboard, Settings, Users } from "lucide-react"
import { Brand } from "@/components/brand"
import { Badge } from "@/components/ui/badge"
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"

const navigation = [
  { href: "/dashboard", label: "نظرة عامة", icon: LayoutDashboard },
  { href: "/projects", label: "المشاريع", icon: FolderKanban },
  { href: "/accounts", label: "الحسابات", icon: Users },
  { href: "/activity", label: "سجل النشاط", icon: Activity },
  { href: "/settings", label: "الإعدادات", icon: Settings },
]

export function AppSidebar() {
  const pathname = usePathname()
  return (
    <Sidebar variant="inset" collapsible="icon" side="right" className="**:data-[slot=sidebar-inner]:border **:data-[slot=sidebar-inner]:border-border **:data-[slot=sidebar-inner]:bg-background">
      <SidebarHeader className="flex min-h-14 flex-row items-center justify-between border-b px-3"><Brand /><Badge variant="secondary" className="group-data-[collapsible=icon]:hidden">v1.0</Badge></SidebarHeader>
      <SidebarContent><SidebarGroup className="px-3 py-4 group-data-[collapsible=icon]:px-2"><SidebarGroupLabel>المنصة</SidebarGroupLabel><SidebarGroupContent><SidebarMenu className="gap-1">{navigation.map((item) => <SidebarMenuItem key={item.href}><SidebarMenuButton asChild isActive={pathname === item.href} tooltip={item.label} className="min-h-10"><Link href={item.href}><item.icon /><span>{item.label}</span></Link></SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu></SidebarGroupContent></SidebarGroup></SidebarContent>
      <SidebarFooter className="border-t p-3"><div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"><span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex size-2 rounded-full bg-emerald-500" /></span><span className="text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">المجدول يعمل محليًا</span></div></SidebarFooter>
    </Sidebar>
  )
}
